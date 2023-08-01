import { version } from "react";
import { BsPaypal } from "react-icons/bs";
import { FaDiscord, FaPatreon,FaTwitter } from "react-icons/fa";
import  { type IconType } from "react-icons/lib";
import { SiBuymeacoffee } from "react-icons/si";

import { ExternalLink } from "./ExternalLink";
import { Logo } from "./Logo";

export function Footer(): JSX.Element {
  return (
    <div className="px-6 text-stone-200 print:hidden">
      <footer className="mx-auto w-full max-w-screen-2xl">
        <nav className="flex w-full flex-col items-center justify-between space-y-16 py-16 md:flex-row md:items-start md:space-y-0">
          <div className="flex h-full w-72 flex-col items-center space-y-6 md:items-start">
            <Logo />
          </div>

          <div className="grid w-full grid-cols-1 items-center text-center md:w-auto md:grid-cols-2 md:items-start md:gap-10 md:text-left">
            <ul />
            <ul className="md:text-right">
              <FooterNavLink
                href="https://www.buymeacoffee.com/rOSn8DF"
                icon={SiBuymeacoffee}
              >
                Buy Me A Coffee
              </FooterNavLink>

              <FooterNavLink
                href="https://www.paypal.com/paypalme/gerritalex"
                icon={BsPaypal}
              >
                PayPal
              </FooterNavLink>

              <FooterNavLink
                href="https://www.patreon.com/RaiderIO"
                icon={FaPatreon}
              >
                Raider.IO Patreon
              </FooterNavLink>

              <FooterNavLink
                href="https://www.patreon.com/warcraftlogs"
                icon={FaPatreon}
              >
                Warcraft Logs Patreon
              </FooterNavLink>

              <FooterNavLink
                href="https://twitter.com/gerrit_alex"
                icon={FaTwitter}
              >
                Twitter
              </FooterNavLink>

              <FooterNavLink icon={FaDiscord}>xepher1s</FooterNavLink>
            </ul>
          </div>
        </nav>

        <small className="flex w-full flex-col items-center justify-center space-x-0 space-y-1 py-2 text-xs text-stone-300 md:flex-row md:justify-end md:space-x-2 md:space-y-0">
          <span>
            All data is retrieved from{" "}
            <ExternalLink className="underline" href="https://raider.io">
              Raider.IO
            </ExternalLink>
            .
          </span>
          <span>
            Logo from{" "}
            <ExternalLink
              className="underline"
              href="https://yilinzc.carrd.co/"
            >
              yilinzc
            </ExternalLink>
            .
          </span>
        </small>

        <small className="flex w-full flex-col justify-center space-x-0 space-y-1 py-2 text-center text-xs text-stone-300 md:flex-row md:justify-end md:space-x-2 md:space-y-0 md:text-right">
          <span>
            World of Warcraft and related artwork is copyright of Blizzard
            Entertainment, Inc.
          </span>
          <span>This is a fan site and we are not affiliated.</span>
        </small>

        <small className="flex w-full items-center justify-center space-x-2 space-y-1 py-2 text-xs text-stone-300 md:justify-end md:space-x-2 md:space-y-0">
          <ExternalLink
            className="flex items-center justify-center space-x-2"
            href="https://vercel.com/"
            aria-label="Vercel"
          >
            <Vercel />
          </ExternalLink>

          <ExternalLink
            className="flex items-center justify-center space-x-2"
            href="https://remix.run/"
            aria-label="Remix"
          >
            <Remix />
          </ExternalLink>

          <ExternalLink
            href={`https://www.npmjs.com/package/react/v/${version}`}
            className="flex"
            aria-label={`React ${version.split("-")[0]}`}
          >
            <React /> {version.split("-")[0]}
          </ExternalLink>

          <ExternalLink href="https://tailwindcss.com/" aria-label="Tailwind">
            <Tailwind />
          </ExternalLink>

          <ExternalLink href="https://supabase.io/" aria-label="Supabase">
            <Supabase />
          </ExternalLink>

          <ExternalLink href="https://upstash.com/" aria-label="Upstash">
            <Upstash />
          </ExternalLink>
        </small>

        <small className="flex w-full items-center justify-center space-x-1 space-y-1 pb-6 pt-2 text-xs text-stone-300 md:justify-end md:space-x-2 md:space-y-0">
          <ExternalLink href="https://github.com/ljosberinn/mplus-title">
            <GitHub />
          </ExternalLink>
        </small>
      </footer>
    </div>
  );
}

function React() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 841.9 595.3"
      className="h-4"
    >
      <g fill="#61DAFB">
        <path d="M666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9V78c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6V78.5c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zM421.2 430c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24 4.7 8 9.5 15.8 14.4 23.4zM420.7 163c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16-13 24-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6 0-15.7 22.9-35.6 58.3-50.6 8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zM310 490c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6zM320.8 78.4z" />
        <circle cx="420.9" cy="296.5" r="45.7" />
        <path d="M520.5 78.1z" />
      </g>
    </svg>
  );
}

function Tailwind() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 33" className="h-4">
      <g clipPath="url(#tailwind-a)">
        <path
          fill="#06B6D4"
          fillRule="evenodd"
          d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z"
          clipRule="evenodd"
        />
      </g>
      <defs>
        <clipPath id="tailwind-a">
          <path fill="#fff" d="M0 0h54v32.4H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function GitHub() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4"
      fill="#fff"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.216.682-.48 0-.236-.008-.864-.013-1.695-2.782.602-3.369-1.337-3.369-1.337-.454-1.151-1.11-1.458-1.11-1.458-.908-.618.069-.606.069-.606 1.003.07 1.531 1.027 1.531 1.027.892 1.524 2.341 1.084 2.91.828.092-.643.35-1.083.636-1.332-2.22-.251-4.555-1.107-4.555-4.927 0-1.088.39-1.979 1.029-2.675-.103-.252-.446-1.266.098-2.638 0 0 .84-.268 2.75 1.022A9.607 9.607 0 0 1 12 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.372.202 2.386.1 2.638.64.696 1.028 1.587 1.028 2.675 0 3.83-2.339 4.673-4.566 4.92.359.307.678.915.678 1.846 0 1.332-.012 2.407-.012 2.734 0 .267.18.577.688.48 3.97-1.32 6.833-5.054 6.833-9.458C22 6.463 17.522 2 12 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Upstash() {
  return (
    <svg
      className="h-4"
      viewBox="0 0 400 472"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#00E9A3"
        d="M.421875 412.975C78.5269 491.079 205.16 491.079 283.265 412.975c78.104-78.105 78.104-204.738 0-282.843l-35.356 35.355c58.579 58.579 58.579 153.554 0 212.132-58.578 58.579-153.5531 58.579-212.1321 0L.421875 412.975Z"
      />
      <path
        fill="#00E9A3"
        d="M71.1328 342.264c39.0522 39.052 102.3682 39.052 141.4212 0 39.052-39.052 39.052-102.369 0-141.421l-35.355 35.355c19.526 19.526 19.526 51.184 0 70.711-19.527 19.526-51.185 19.526-70.711 0l-35.3552 35.355ZM353.974 59.421c-78.105-78.1045-204.738-78.1045-282.8425 0-78.10502 78.105-78.10502 204.738 0 282.843l35.3545-35.355c-58.5775-58.579-58.5775-153.554 0-212.132 58.579-58.579 153.554-58.579 212.132 0l35.356-35.356Z"
      />
      <path
        fill="#00E9A3"
        d="M283.264 130.132c-39.052-39.052-102.37-39.052-141.422 0-39.053 39.053-39.053 102.369 0 141.421l35.355-35.355c-19.526-19.526-19.526-51.184 0-70.711 19.526-19.526 51.184-19.526 70.711 0l35.356-35.355Z"
      />
      <path
        fill="#fff"
        fillOpacity=".8"
        d="M353.974 59.421c-78.105-78.1045-204.738-78.1045-282.8425 0-78.10502 78.105-78.10502 204.738 0 282.843l35.3545-35.355c-58.5775-58.579-58.5775-153.554 0-212.132 58.579-58.579 153.554-58.579 212.132 0l35.356-35.356Z"
      />
      <path
        fill="#fff"
        fillOpacity=".8"
        d="M283.264 130.132c-39.052-39.052-102.37-39.052-141.422 0-39.053 39.053-39.053 102.369 0 141.421l35.355-35.355c-19.526-19.526-19.526-51.184 0-70.711 19.526-19.526 51.184-19.526 70.711 0l35.356-35.355Z"
      />
    </svg>
  );
}

function Remix() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 800 800"
      className="h-4"
    >
      <path fill="#212121" d="M0 0h800v800H0z" />
      <g fill="#E8F2FF" filter="url(#a)">
        <path
          fillRule="evenodd"
          d="M587.947 527.768c4.254 54.65 4.254 80.268 4.254 108.232H465.756c0-6.091.109-11.663.219-17.313.342-17.564.699-35.88-2.147-72.868-3.761-54.152-27.08-66.185-69.957-66.185H195v-98.525h204.889c54.16 0 81.241-16.476 81.241-60.098 0-38.357-27.081-61.601-81.241-61.601H195V163h227.456C545.069 163 606 220.912 606 313.42c0 69.193-42.877 114.319-100.799 121.84 48.895 9.777 77.48 37.605 82.746 92.508Z"
          clipRule="evenodd"
        />
        <path d="M195 636v-73.447h133.697c22.332 0 27.181 16.563 27.181 26.441V636H195Z" />
      </g>
      <defs>
        <filter
          id="a"
          width="539"
          height="601"
          x="131"
          y="99"
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="28" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix values="0 0 0 0 0.223529 0 0 0 0 0.572549 0 0 0 0 1 0 0 0 1 0" />
          <feBlend
            in2="BackgroundImageFix"
            result="effect1_dropShadow_126_53"
          />
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="32" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix values="0 0 0 0 0.223529 0 0 0 0 0.572549 0 0 0 0 1 0 0 0 0.9 0" />
          <feBlend
            in2="effect1_dropShadow_126_53"
            result="effect2_dropShadow_126_53"
          />
          <feBlend
            in="SourceGraphic"
            in2="effect2_dropShadow_126_53"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
}

function Vercel() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1155 1000"
      className="h-4"
    >
      <path fill="white" d="m577.344 0 577.346 1000H0L577.344 0Z" />
    </svg>
  );
}

function Supabase() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 109 113"
      className="h-4"
    >
      <path
        fill="url(#supabase-a)"
        d="M63.7076 110.284c-2.8595 3.601-8.6574 1.628-8.7263-2.97l-1.0075-67.2513h45.2197c8.1905 0 12.7585 9.4601 7.6655 15.8747L63.7076 110.284Z"
      />
      <path
        fill="url(#supabase-b)"
        fillOpacity=".2"
        d="M63.7076 110.284c-2.8595 3.601-8.6574 1.628-8.7263-2.97l-1.0075-67.2513h45.2197c8.1905 0 12.7585 9.4601 7.6655 15.8747L63.7076 110.284Z"
      />
      <path
        fill="#3ECF8E"
        d="M45.317 2.071c2.8595-3.6014 8.6575-1.628 8.7264 2.97l.4415 67.2512H9.8311c-8.1907 0-12.7588-9.4601-7.6656-15.8747L45.317 2.071Z"
      />
      <defs>
        <linearGradient
          id="supabase-a"
          x1="53.9738"
          x2="94.1635"
          y1="54.974"
          y2="71.8295"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#249361" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient
          id="supabase-b"
          x1="36.1558"
          x2="54.4844"
          y1="30.578"
          y2="65.0806"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type FooterNavLinkProps = {
  href?: string;
  children: string;
  icon: IconType;
};

function FooterNavLink({ href, children, icon: Icon }: FooterNavLinkProps) {
  const body = (
    <span className="md:flex md:items-center md:justify-end">
      <Icon className="mr-2 inline h-6 w-6" />
      {children}
    </span>
  );

  return (
    <li className="py-1 text-base leading-relaxed md:text-sm">
      {href ? (
        <ExternalLink className="transition-colors duration-150 ease-in-out hover:text-yellow-600" href={href}>
          {body}
        </ExternalLink>
      ) : (
        body
      )}
    </li>
  );
}
