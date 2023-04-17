import { ActionFunction, redirect } from "@remix-run/node";
import type { Regions } from "@prisma/client";
import { orderedRegionsBySize } from "~/utils";

const determineRegionsFromFormData =  (
  formData: FormData
): Regions[] => {
  return orderedRegionsBySize.filter((region) => formData.get(region) === "on");
};

const addRegionsToReferrerOrBaseUrl = (
  request: Request,
  regions: Regions[]
) => {
  const referer = request.headers.get("Referer");

  if (referer) {
    const refererAsUrl = new URL(referer);
    refererAsUrl.searchParams.set("regions", regions.join("~"));
    return refererAsUrl.toString();
  }

  const searchParams = new URLSearchParams({ regions: regions.join("~") });
  return `/?${searchParams.toString()}`;
};

export const action: ActionFunction = async ({ request }) => {
  const bodyData = await request.formData();
  const regions = determineRegionsFromFormData(bodyData);

  return redirect(addRegionsToReferrerOrBaseUrl(request, regions));
};
