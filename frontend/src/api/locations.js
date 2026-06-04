import client from "./client";

export const locationsApi = {
  resolvePincode: (pincode) =>
    client.get(`/locations/resolve-pincode?pincode=${pincode}`),
};
