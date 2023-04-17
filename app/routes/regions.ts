import { type Regions } from "@prisma/client";
import { type ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { setCookie } from "~/load.server";
import { orderedRegionsBySize, searchParamSeparator } from "~/utils";

const addRegionsToReferrerOrBaseUrl = (
  request: Request,
  regions: Regions[]
): { url: string; headers: HeadersInit } => {
  const headers: HeadersInit = {};
  const referer = request.headers.get("Referer");

  if (referer) {
    const refererAsUrl = new URL(referer);

    if (regions.length === orderedRegionsBySize.length) {
      refererAsUrl.searchParams.delete("regions");
    } else {
      refererAsUrl.searchParams.set(
        "regions",
        regions.join(searchParamSeparator)
      );
    }

    const nextValue = refererAsUrl.searchParams.get("regions");

    headers["Set-Cookie"] = setCookie(
      "regions",
      nextValue,
      nextValue ? 365 * 24 * 60 * 60 * 1000 : 0
    );

    return {
      url: refererAsUrl.toString(),
      headers,
    };
  }

  const searchParams = new URLSearchParams(
    regions.length === orderedRegionsBySize.length
      ? undefined
      : { regions: regions.join(searchParamSeparator) }
  );
  const paramsAsString = searchParams.toString();

  const nextValue = searchParams.get("regions");

  headers["Set-Cookie"] = setCookie(
    "regions",
    nextValue,
    nextValue ? 365 * 24 * 60 * 60 * 1000 : 0
  );

  return {
    headers,
    url: paramsAsString ? `/?${paramsAsString}` : "/",
  };
};

export const action: ActionFunction = async ({ request }) => {
  const bodyData = await request.formData();
  const activeRegions = orderedRegionsBySize.filter(
    (region) => bodyData.get(region) === "on"
  );

  const { url, headers } = addRegionsToReferrerOrBaseUrl(
    request,
    activeRegions
  );

  return redirect(url, { headers });
};
