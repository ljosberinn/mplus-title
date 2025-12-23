import React from "react";

export default function StreamingTools(): React.ReactNode {
  return (
    <>
      We're offering two tiny, localized plaintext endpoints:
      <ul>
        <li>
          <code>/api/affixes/$region</code>

          <details>
            <summary>optional parameters</summary>

            <ul>
              <li>
                GET <code>locale</code>
              </li>
              <li>
                value of: <code>en</code> (default) | <code>de</code>
              </li>
            </ul>
          </details>

          <p>
            example: `/api/affixes/eu` yields `Current Week: Tyrannical,
            Volcanic, Sanguine | Next Week: Fortified, Storming, Bursting`
          </p>
        </li>

        <li>
          <code>/api/cutoff/$region</code>

          <details>
            <summary>optional parameters</summary>

            <ul>
              <li>
                GET <code>locale</code>
              </li>
              <li>
                value of: <code>en</code> (default) | <code>de</code>
              </li>
            </ul>
          </details>

          <p>
            example: `/api/cutoff/eu` yields `Current: 3669.7 | Estimation (+2
            weeks): 3701.5`
          </p>
        </li>
      </ul>
      <details>
        <summary>Activate Cloudbot</summary>
        :yep:
      </details>
      <details>
        <summary>Add Custom Command</summary>
        :yep:
      </details>
    </>
  );
}
