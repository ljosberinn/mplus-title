import { type ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { determineOverlaysFromFormData } from "~/load.server";
import { type Overlay, overlays } from "~/utils";

const addOverlaysToReferrerOrBaseUrl = (
  request: Request,
  plotlines: readonly Overlay[]
) => {
  const referer = request.headers.get("Referer");
  if (referer) {
    const refererAsUrl = new URL(referer);
    
    if (plotlines.length === overlays.length) {
      refererAsUrl.searchParams.delete("overlays");
    } else {
      refererAsUrl.searchParams.set("overlays", plotlines.join("~"));
    }

    return refererAsUrl.toString();
  }
  const searchParams = new URLSearchParams(
    plotlines.length === overlays.length
      ? undefined
      : {
          overlays: plotlines.join(","),
        }
  );
  return `/?${searchParams.toString()}`;
};

export const action: ActionFunction = async ({ request }) => {
  const headers: HeadersInit = {};

  const bodyData = await request.formData();

  const overlays = determineOverlaysFromFormData(bodyData);

  return redirect(addOverlaysToReferrerOrBaseUrl(request, overlays), {
    headers,
  });
};
