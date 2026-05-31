import { apiGet } from '../api/http.js';
import { LOOKUPS } from '../api/endpoints.js';

export async function getDeviceFilters() {
    return apiGet(LOOKUPS.DEVICE_FILTERS);
}

export async function getRoomBookingLookups() {
    return apiGet(LOOKUPS.ROOM_BOOKING);
}

export async function getUsersForSelect() {
    return apiGet(LOOKUPS.USERS);
}
