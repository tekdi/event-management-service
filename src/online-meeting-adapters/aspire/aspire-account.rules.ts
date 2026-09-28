import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeetingType } from 'src/common/utils/types';

/**
 * Everything a caller tells us about the event so an account can be picked.
 *
 * Callers pass `metadata` as-is and never interpret it - only the rules in this
 * file look inside it. That way event / attendee / attendance code stays free of
 * product concepts like "pathway".
 */
export interface MeetingAccountContext {
  /** eventDetail.metadata (or createEventDto.metaData on create). */
  metadata?: Record<string, any> | null;
  /** 'meeting' | 'webinar', as stored on the event. */
  meetingType?: MeetingType | string;
  /** What is being done - only used for logging, e.g. 'create', 'addRegistrant'. */
  operation?: string;
}

/** The account a rule resolved to. */
export interface ZoomAccountDetails {
  /** Provider key registered in OnlineMeetingAdapter, e.g. 'zoom' | 'pathway-zoom'. */
  provider: string;
  /** Short label for logs. */
  label: string;
  /** Why this account was chosen - shown in logs to make routing auditable. */
  reason: string;
}

/**
 * ASPIRE PRODUCT RULES - the only place that decides which Zoom account is used.
 *
 * Every flow (create, update, delete, enrollment, unenrollment and attendance)
 * resolves its account through getAccountDetails(), so changing a rule here
 * changes all of them at once. To support a new case, add a rule below and - if
 * it needs a new Zoom account - register that account in OnlineMeetingAdapter.
 *
 * A rule must only read values that are PERSISTED on the event (metadata and
 * meetingType), never request input. Create, update, enrollment and attendance
 * each resolve independently at different times; if they saw different values
 * they would land on different accounts and Zoom would 404.
 */
@Injectable()
export class AspireAccountRules {
  constructor(private readonly configService: ConfigService) {}

  getAccountDetails(ctx: MeetingAccountContext): ZoomAccountDetails {
    // RULE 1 - Pathway meetings run on the dedicated Pathway Zoom account.
    // Pathway webinars stay on the main account, because the webinar licence
    // lives there.
    if (
      ctx.metadata?.isPathway === true &&
      ctx.meetingType !== MeetingType.webinar
    ) {
      return {
        provider: 'pathway-zoom',
        label: 'NEW (PATHWAY) ACCOUNT SELECTED',
        reason: 'pathway + meeting',
      };
    }

    // ---- ADD FUTURE RULES ABOVE THIS LINE ----

    // Default: the main Zoom account.
    return {
      provider: this.configService.get('ONLINE_MEETING_ADAPTER') || 'zoom',
      label: 'MAIN ACCOUNT SELECTED',
      reason:
        ctx.metadata?.isPathway === true ? 'pathway + webinar' : 'no rule matched',
    };
  }
}
