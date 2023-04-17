import { ActionFunction, redirect } from "@remix-run/node";
import { determineRegionsFromFormData } from "~/load.server";
import type { Regions } from "@prisma/client";

const addRegionsToReferrerOrBaseUrl = (
  request: Request,
  regions: Regions[]
) => {
  const referer = request.headers.get("Referer");
  if (referer) {
    const refererAsUrl = new URL(referer);
    refererAsUrl.searchParams.set("regions", regions.join("~"));
    return refererAsUrl.toString();
  } else {
    const searchParams = new URLSearchParams({ regions: regions.join(",") });
    return `/?${searchParams.toString()}`;
  }
};

export const action: ActionFunction = async ({ request }) => {
  const headers: HeadersInit = {};

  const bodyData = await request.formData();

  const regions = await determineRegionsFromFormData(bodyData);

  return redirect(addRegionsToReferrerOrBaseUrl(request, regions), { headers });
};
