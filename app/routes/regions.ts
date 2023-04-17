import { ActionFunction, redirect } from "@remix-run/node";
import {
  determineRegionsFromFormData,
  regionsToDisplayCookie,
} from "~/load.server";

const setCookie = "Set-Cookie";
export const action: ActionFunction = async ({ request }) => {
  const headers: HeadersInit = {};

  const bodyData = await request.formData();

  const regions = await determineRegionsFromFormData(bodyData);
  headers[setCookie] = await regionsToDisplayCookie.serialize(
    regions.join(",")
  );

  return redirect(request.headers.get("referer") ?? "/", { headers });
};
