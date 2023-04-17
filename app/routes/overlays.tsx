import { type ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { type Overlay, overlays, searchParamSeparator } from "~/utils";

const addOverlaysToReferrerOrBaseUrl = (
  request: Request,
  plotlines: readonly Overlay[]
): { url: string; headers: HeadersInit } => {
  const referer = request.headers.get("Referer");
  const headers: HeadersInit = {};

  if (referer) {
    const refererAsUrl = new URL(referer);

    if (plotlines.length === overlays.length) {
      refererAsUrl.searchParams.delete("overlays");
    } else {
      refererAsUrl.searchParams.set(
        "overlays",
        plotlines.join(searchParamSeparator)
      );
    }

    const nextValue = refererAsUrl.searchParams.get("overlays");

    if (nextValue) {
      headers["Set-Cookie"] = `overlays=${nextValue}`;
    } else {
      headers["Set-Cookie"] = `overlays=; Expires=${new Date(0).toUTCString()}`;
    }

    return {
      url: refererAsUrl.toString(),
      headers,
    };
  }

  const searchParams = new URLSearchParams(
    plotlines.length === overlays.length
      ? undefined
      : {
          overlays: plotlines.join(searchParamSeparator),
        }
  );
  const paramsAsString = searchParams.toString();

  const nextValue = searchParams.get("overlays");

  if (nextValue) {
    headers["Set-Cookie"] = `overlays=${nextValue}`;
  } else {
    headers["Set-Cookie"] = `overlays=; Expires=${new Date(0).toUTCString()}`;
  }

  return {
    url: paramsAsString ? `/?${paramsAsString}` : "/",
    headers,
  };
};

export const action: ActionFunction = async ({ request }) => {
  const bodyData = await request.formData();
  const activeOverlays = overlays.filter(
    (plotline) => bodyData.get(plotline) === "on"
  );

  const { url, headers } = addOverlaysToReferrerOrBaseUrl(
    request,
    activeOverlays
  );

  return redirect(url, { headers });
};
