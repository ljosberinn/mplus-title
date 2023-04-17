import { type Regions } from "@prisma/client";
import { type ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

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

    if (nextValue) {
      headers["Set-Cookie"] = `regions=${nextValue}`;
    } else {
      headers["Set-Cookie"] = `regions=; Expires=${new Date(0).toUTCString()}`;
    }

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

  if (nextValue) {
    headers["Set-Cookie"] = `regions=${nextValue}`;
  } else {
    headers["Set-Cookie"] = `regions=; Expires=${new Date(0).toUTCString()}`;
  }

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
