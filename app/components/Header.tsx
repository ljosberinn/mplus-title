import { Nav } from "~/components/Nav";

const title = "Mythic+ Estimated Title Cutoff";

export function Header(): JSX.Element {
  return (
    <header className="container mx-auto">
      <h1 className="pb-2 pt-8 text-center text-2xl font-semibold">{title}</h1>

      <p className="pb-4 text-center italic">updates hourly</p>
      <p className="pb-4 text-center italic">
        extrapolation ignores the first FOUR weeks of a season. further weeks
        are weighted relatively to today
      </p>

      <div className="pb-4 text-center">
        <a
          className="cursor-pointer pb-4 underline"
          target="_blank"
          rel="noreferrer noopener"
          href="https://forms.gle/xWwPFGJ5DKyntRgq9"
        >
          help improving the site by answering a couple questions
        </a>
      </div>
      <Nav />
    </header>
  );
}
