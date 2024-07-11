import { Injectable } from "@nestjs/common";
import { MeetingServiceInterface } from '../interface/meeting-service.interface'
import { CreateMeetingDto } from "../dto/create-Meeting.dto";
import axios from "axios";
import { ConfigService } from "@nestjs/config";
import { UpdateeMeetingDto } from "../dto/update-Meeting.dto";

@Injectable()
export class ZoomMeetingAdapter implements MeetingServiceInterface {
    private zoom_url: string
    private zoom_auth_url: string;
    private account_id: string;
    private client_id: string;
    private secret_token: string;
    private zoom_update_get_url: string

    constructor(private readonly configService: ConfigService) {
        this.zoom_url = this.configService.get('ZOOM_URL')
        this.zoom_auth_url = this.configService.get('ZOOM_AUTH_URL')
        this.zoom_update_get_url = this.configService.get('ZOOM_UPDATE_GET_URL')
        this.account_id = this.configService.get('ZOOM_ACCOUNT_ID')
        this.client_id = this.configService.get('ZOOM_CLIENT_ID')
        this.secret_token = this.configService.get('ZOOM_SECRET_TOKEN')
    }
    async createMeeting(createMeetingDto: CreateMeetingDto) {
        try {
            const token = await this.getToken();
            if (!token) {
                throw new Error('Failed to retrieve access token');
            }
            const resp = await axios.post(this.zoom_url, createMeetingDto, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const { id, password } = resp.data;
            return { id, password }
            // return resp.data;
        }
        catch (err) {
            if (err.response && err.response.status === 400) {
                throw new Error('Bad request: ' + err.response.data.message);
            } else if (err.response && err.response.status) {
                throw new Error(`Error ${err.response.status}: ${err.response.data.message}`);
            } else {
                throw new Error('Internal server error');
            }
        }
    }
    async getMeetingList() {
        try {
            const token = await this.getToken();
            if (!token) {
                throw new Error('Failed to retrieve access token');
            }
            const resp = await axios.get(this.zoom_url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const meetings = resp.data.meetings;
            const result = meetings.map((obj) =>
                ["id", "topic"].reduce((newObj, key) => {
                    newObj[key] = obj[key];
                    return newObj;
                }, {})
            );
            return result;

        } catch (e) {
            throw new Error(e.message || 'Internal server error');
        }
    }

    async getToken() {
        try {
            const base64Credentials = Buffer.from(`${this.client_id}:${this.secret_token}`).toString('base64');
            const resp = await axios.post(
                `${this.zoom_auth_url}?grant_type=account_credentials&account_id=${this.account_id}`,
                {},
                {
                    headers: {
                        Authorization: `Basic ${base64Credentials}`,
                    },
                }
            );
            return resp.data.access_token;
        } catch (e) {
            return e.message;
        }
    }

    async updateMeeting(meetingId, updateeMeetingDto: UpdateeMeetingDto) {
        try {
            const token = await this.getToken();
            if (!token) {
                throw new Error('Failed to retrieve access token');
            }
            const resp = await axios.patch(`${this.zoom_update_get_url}/${meetingId}`, updateeMeetingDto, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return resp;
        }
        catch (e) {
            return e;
        }
    }
    checkZoomConfig(): string | null {
        return (this.zoom_url && this.zoom_auth_url && this.account_id && this.client_id && this.secret_token) ? 'zoom' : null;
    }

}
