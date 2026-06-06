"use client";

import { PropsWithChildren, useMemo } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export function AppThemeProvider({ children }: PropsWithChildren) {
  const theme = useMemo(
    () =>
      createTheme({
        cssVariables: true,
        palette: {
          mode: "dark",
          primary: {
            main: "#5ad7ff",
            light: "#93e7ff",
            dark: "#0f9cc6",
          },
          secondary: {
            main: "#8dffba",
            light: "#c4ffd7",
            dark: "#29bf74",
          },
          background: {
            default: "#0a101a",
            paper: "#101927",
          },
          text: {
            primary: "#e6edf7",
            secondary: "#a3b2c9",
          },
          divider: "rgba(145, 163, 190, 0.2)",
        },
        shape: {
          borderRadius: 18,
        },
        typography: {
          fontFamily: "var(--font-sora), sans-serif",
          h1: {
            fontWeight: 700,
            letterSpacing: "-0.02em",
          },
          h2: {
            fontWeight: 700,
          },
          h3: {
            fontWeight: 600,
          },
          button: {
            textTransform: "none",
            fontWeight: 600,
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage:
                  "linear-gradient(165deg, rgba(35,55,84,0.36) 0%, rgba(16,25,39,0.95) 55%)",
                backdropFilter: "blur(14px)",
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 10,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
            },
          },
        },
      }),
    [],
  );

  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
