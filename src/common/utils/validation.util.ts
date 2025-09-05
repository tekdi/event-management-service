import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

function validateMeetingUrl(url, provider) {
  const providerPatterns = {
    zoom: {
      meeting: /^https?:\/\/[\w-]*\.?zoom\.(com|us)\/(j|my)\/[\w-]+(\?.*)?$/,
      webinar:
        /^https?:\/\/[\w-]*\.?zoom\.(com|us)\/(w|webinar)\/[\w-]+(\?.*)?$/,
    },
    googlemeet:
      /^https?:\/\/meet\.(google\.com|[a-zA-Z0-9-]+\.com)\/[a-z]{3,}-[a-z]{3,}-[a-z]{3}(\?.*)?$/,
    // microsoftteams: /^(https:\/\/)?teams\.microsoft\.com\/[a-zA-Z0-9?&=]+$/,
    // Add other supported providers as needed
  };
  if (
    !url ||
    typeof url !== 'string' ||
    !provider ||
    typeof provider !== 'string'
  ) {
    return false;
  }

  if (provider.toLowerCase() === 'zoom') {
    // For Zoom, check both meeting and webinar patterns
    return (
      providerPatterns.zoom.meeting.test(url) ||
      providerPatterns.zoom.webinar.test(url)
    );
  }

  const pattern = providerPatterns[provider.toLowerCase()];
  if (!pattern) {
    return false; // Unsupported provider
  }

  return pattern.test(url);
}

@ValidatorConstraint({ name: 'UrlWithProviderValidator', async: false })
export class UrlWithProviderValidator implements ValidatorConstraintInterface {
  validate(url: string, args: ValidationArguments) {
    const object = args.object as any;
    const provider = object.onlineProvider || object.parent?.onlineProvider;
    return validateMeetingUrl(url, provider);
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const provider = object.onlineProvider || object.parent?.onlineProvider;
    return `Invalid ${provider || 'meeting'} URL format`;
  }
}
