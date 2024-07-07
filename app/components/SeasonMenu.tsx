import { type Node } from "@react-types/shared";
import {
  NavLink,
  useNavigation,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import clsx from "clsx";
import { type MutableRefObject, type ReactNode } from "react";
import { useRef } from "react";
import { type AriaButtonProps, type AriaPopoverProps } from "react-aria";
import { type AriaMenuProps } from "react-aria";
import {
  Overlay,
  useButton,
  useMenu,
  useMenuItem,
  useMenuSection,
  useMenuTrigger,
  usePopover,
} from "react-aria";
import { type OverlayTriggerState, type TreeState } from "react-stately";
import { type MenuTriggerProps } from "react-stately";
import {
  Item,
  Section,
  useMenuTriggerState,
  useTreeState,
} from "react-stately";
import { ClientOnly } from "remix-utils/client-only";

import { type Season } from "~/seasons";
import { seasons } from "~/seasons";

export function SeasonMenu(): JSX.Element {
  const now = Date.now();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const { season: selectedSeasonSlug } = useParams();

  const paramsAsString = params ? `?${params.toString()}` : "";

  const selectedSeason = seasons.find(
    (season) => season.slug === selectedSeasonSlug,
  );

  return (
    <MenuButton
      label={
        selectedSeason ? (
          <SeasonNavItemBody season={selectedSeason} />
        ) : (
          <>Seasons</>
        )
      }
    >
      <ClientOnly fallback={null}>
        {() => seasons
          .reduce<{ label: string; seasons: Season[] }[]>((acc, season) => {
            const lastSection = acc[acc.length - 1];
            const [prefix] = season.slug.split("-");

            if (lastSection) {
              const lastSeasonOfLastSection =
                lastSection.seasons[lastSection.seasons.length - 1];
              const [otherPrefix] = lastSeasonOfLastSection.slug.split("-");

              if (prefix === otherPrefix) {
                lastSection.seasons.push(season);
                return acc;
              }
            }

            acc.push({ label: prefix, seasons: [season] });

            return acc;
          }, [])
          .map((section, sectionIndex, sections) => {
            const isLastSection = sectionIndex === sections.length - 1;

            return (
              <Section key={section.label} title={section.label.toUpperCase()}>
                {section.seasons.map((season, index, seasons) => {
                  const disabled =
                    selectedSeason?.slug === season.slug ||
                    season.startDates.US === null ||
                    season.startDates.US > now ||
                    navigation.state !== "idle";

                  const isLast = isLastSection && index === seasons.length - 1;

                  return (
                    <Item key={season.slug} textValue={season.name}>
                      {disabled ? (
                        <span
                          className={clsx(
                            "flex flex-1 space-x-2 bg-gray-800 px-4 py-2 text-white outline-none grayscale transition-all duration-200 ease-in-out",
                            navigation.state === "idle"
                              ? "cursor-not-allowed"
                              : "cursor-wait",
                            isLast && "rounded-b-lg",
                          )}
                        >
                          <SeasonNavItemBody season={season} />
                        </span>
                      ) : (
                        <NavLink
                          className={clsx(
                            "flex flex-1 space-x-2 bg-gray-700 px-4 py-2 text-white outline-none transition-all duration-200 ease-in-out hover:bg-gray-500",
                            isLast && "rounded-b-lg",
                          )}
                          to={`/${season.slug}${paramsAsString}`}
                        >
                          <SeasonNavItemBody season={season} />
                        </NavLink>
                      )}
                    </Item>
                  );
                })}
              </Section>
            );
          })}
      </ClientOnly>
    </MenuButton>
  );
}

type PopoverProps = {
  children: ReactNode;
  state: OverlayTriggerState;
} & Omit<AriaPopoverProps, "popoverRef">;

function Popover({ children, state, ...props }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const { popoverProps, underlayProps } = usePopover(
    {
      ...props,
      popoverRef,
    },
    state,
  );

  return (
    <Overlay>
      <div {...underlayProps} className="fixed inset-0" />
      <div
        {...popoverProps}
        ref={popoverRef}
        style={popoverProps.style}
        className="mt-1 space-y-1 rounded-md shadow-lg"
      >
        {children}
      </div>
    </Overlay>
  );
}

function Button(
  props: AriaButtonProps & {
    buttonRef: MutableRefObject<HTMLButtonElement | null>;
  },
) {
  const ref = props.buttonRef;
  const { buttonProps } = useButton(props, ref);

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      className="flex space-x-2 rounded-lg bg-gray-700 px-4 py-2 font-medium text-white outline-none ring-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-500 focus:outline-none focus:ring-2"
    >
      {props.children}
    </button>
  );
}

type MenuItemProps<T> = {
  item: Node<T>;
  state: TreeState<T>;
};

function MenuItem<T>({ item, state }: MenuItemProps<T>) {
  const ref = useRef<HTMLLIElement | null>(null);
  const { menuItemProps, isSelected } = useMenuItem(
    { key: item.key },
    state,
    ref,
  );

  return (
    <li
      {...menuItemProps}
      // otherwise prevents `a` interaction
      onPointerUp={undefined}
      ref={ref}
      className={clsx("flex cursor-pointer justify-between outline-none")}
    >
      {item.rendered}
      {isSelected && <span aria-hidden="true">✅</span>}
    </li>
  );
}

function Menu<T extends object>(props: AriaMenuProps<T>) {
  const state = useTreeState(props);

  const ref = useRef<HTMLUListElement | null>(null);
  const { menuProps } = useMenu(props, state, ref);

  return (
    <ul {...menuProps} ref={ref} className="m-0 w-56 list-none rounded-md">
      {[...state.collection].map((item) =>
        item.type === "section" ? (
          <MenuSection key={item.key} section={item} state={state} />
        ) : (
          <MenuItem key={item.key} item={item} state={state} />
        ),
      )}
    </ul>
  );
}

type MenuButtonProps<T> = {
  label?: ReactNode;
} & AriaMenuProps<T> &
  MenuTriggerProps;

function MenuButton<T extends object>(props: MenuButtonProps<T>) {
  const state = useMenuTriggerState(props);
  const ref = useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger<T>({}, state, ref);

  return (
    <>
      <Button {...menuTriggerProps} buttonRef={ref}>
        {props.label}
        <span
          aria-hidden="true"
          className={clsx("pl-1 transition-all", state.isOpen && "rotate-180")}
        >
          ▼
        </span>
      </Button>
      {state.isOpen && (
        <Popover state={state} triggerRef={ref} placement="bottom end">
          <Menu {...props} {...menuProps} />
        </Popover>
      )}
    </>
  );
}

type MenuSectionProps<T> = {
  section: Node<T>;
  state: TreeState<T>;
};

function MenuSection<T>({ section, state }: MenuSectionProps<T>) {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    heading: section.rendered,
    "aria-label": section["aria-label"],
  });

  const isFirst = section.key === state.collection.getFirstKey();

  return (
    <li {...itemProps}>
      {section.rendered && (
        <span
          {...headingProps}
          className={clsx(
            "inline-block w-full bg-gray-600 px-4 py-1 text-lg font-semibold",
            isFirst && "rounded-t-lg",
          )}
        >
          {section.rendered}
        </span>
      )}
      <ul {...groupProps} className="list-none p-0">
        {/* literally how its mentioned in the docs and state.collection.getChildren is not a fn */}
        {[...section.childNodes].map((node) => (
          <MenuItem key={node.key} item={node} state={state} />
        ))}
      </ul>
    </li>
  );
}

function SeasonNavItemBody({ season }: { season: Season }) {
  return (
    <>
      <img
        src={season.seasonIcon}
        alt=""
        loading="lazy"
        height="24"
        width="24"
        className="h-6 w-6"
      />
      <span className="flex-1">{season.name.split(" ")[1]}</span>
    </>
  );
}
