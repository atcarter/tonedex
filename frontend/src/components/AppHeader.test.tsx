import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider as SCThemeProvider } from "styled-components";
import { ThemeProvider } from "@mui/material/styles";
import { AppHeader } from "./AppHeader";
import { buildTheme } from "../theme";
import type { User } from "../types";

vi.mock("../hooks/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../hooks/useUi", () => ({ useUi: vi.fn() }));
vi.mock("../hooks/useSuggestions", () => ({
  useSuggestions: () => ({ data: undefined }),
}));
vi.mock("./GameSelector", () => ({
  GameSelector: () => <div data-testid="game-selector" />,
}));
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => <div data-testid="google-login" />,
}));

const { useAppContext } = await import("../hooks/useAppContext");
const { useUi } = await import("../hooks/useUi");

const theme = buildTheme("light");

// jsdom has no matchMedia. Answer MUI's width queries as a browser of the
// given width would, so useMediaQuery picks the phone or desktop header.
function setViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    const matches =
      (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}

function setup({ width, user = null }: { width: number; user?: User | null }) {
  setViewportWidth(width);
  vi.mocked(useAppContext).mockReturnValue({
    selectedGame: null,
    currentUser: user,
    signIn: vi.fn(),
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAppContext>);
  vi.mocked(useUi).mockReturnValue({
    colorMode: "light",
    toggleColorMode: vi.fn(),
  } as unknown as ReturnType<typeof useUi>);

  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <AppHeader />
        </SCThemeProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("AppHeader on a phone", () => {
  it("shows search and account buttons instead of the inline input", () => {
    setup({ width: 375 });

    expect(screen.getByTestId("game-selector")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "open search" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "account" })).toBeInTheDocument();
    expect(screen.queryByLabelText("search pokemon")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "favorites" }),
    ).not.toBeInTheDocument();
    // Google's sign-in button waits for the account menu
    expect(screen.queryByTestId("google-login")).not.toBeInTheDocument();
  });

  it("expands the search with focus, and close collapses it", async () => {
    const user = setup({ width: 375 });

    await user.click(screen.getByRole("button", { name: "open search" }));

    const input = screen.getByLabelText("search pokemon");
    expect(input).toHaveFocus();
    expect(screen.queryByTestId("game-selector")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "close search" }));

    expect(screen.queryByLabelText("search pokemon")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "open search" })).toHaveFocus();
  });

  it("collapses the expanded search on Escape", async () => {
    const user = setup({ width: 375 });

    await user.click(screen.getByRole("button", { name: "open search" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("search pokemon")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "open search" }),
    ).toBeInTheDocument();
  });

  it("lists Favorites, the color-mode item and sign-in in the account menu", async () => {
    const user = setup({ width: 375 });

    await user.click(screen.getByRole("button", { name: "account" }));

    const menu = await screen.findByRole("menu");
    expect(
      screen.getByRole("menuitem", { name: "Favorites" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
    expect(menu).toContainElement(screen.getByTestId("google-login"));
  });

  it("offers Sign out in the account menu when signed in", async () => {
    const user = setup({
      width: 375,
      user: { id: 1, email: "t@e.com", name: "Test User", avatar_url: "" },
    });

    await user.click(screen.getByRole("button", { name: "account" }));

    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("google-login")).not.toBeInTheDocument();
  });
});

describe("AppHeader on desktop", () => {
  it("renders the inline search input and the favorites icon", () => {
    setup({ width: 1280 });

    expect(screen.getByLabelText("search pokemon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "favorites" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "toggle color mode" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("google-login")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "open search" }),
    ).not.toBeInTheDocument();
  });
});
