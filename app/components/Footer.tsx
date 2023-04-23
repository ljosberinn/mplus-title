import Discord from "~/components/icons/Discord";
import GitHub from "~/components/icons/GitHub";
import Patreon from "~/components/icons/Patreon";
import RaiderIO from "~/components/icons/RaiderIO";
import Twitter from "~/components/icons/Twitter";

export function Footer(): JSX.Element {
  return (
    <footer className="container mx-auto px-4 py-6 lg:py-8">
      <div className="mt-4 flex flex-col items-center justify-center gap-1 sm:mt-0 md:flex-row md:flex-wrap">
        <a
          className="mr-4 hover:underline"
          href="https://github.com/ljosberinn/mplus-title"
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHub className="mr-1 inline-block" />
          github
        </a>
        <a
          className="mr-4 hover:underline"
          href="https://twitter.com/gerrit_alex"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Twitter className="mr-1 inline-block" />
          twitter
        </a>
        <a
          className="mr-4 hover:underline"
          href="https://www.patreon.com/warcraftlogs"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Patreon className="mr-1 inline-block" />
          patreon (WarcraftLogs)
        </a>
        <a
          className="mr-4 hover:underline"
          href="https://www.patreon.com/RaiderIO"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Patreon className="mr-1 inline-block" />
          patreon (RaiderIO)
        </a>
        <a
          className="mr-4 hover:underline"
          href="https://raider.io/characters/eu/twisting-nether/Xepheris"
          rel="noopener noreferrer"
          target="_blank"
        >
          <RaiderIO className="mr-1 inline-block" />
          rio
        </a>
        <div>
          <Discord className="mr-1 inline-block" />
          Xepheris#6539
        </div>
      </div>
    </footer>
  );
}
