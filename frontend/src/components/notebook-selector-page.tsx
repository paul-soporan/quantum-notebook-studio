"use client";

import Link from "next/link";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import GitHub from "@mui/icons-material/GitHub";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
} from "@mui/material";
import { NOTEBOOK_CATALOG } from "@/data/notebook-catalog";
import { AppFooter } from "@/components/app-footer";

export function NotebookSelectorPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(circle at 12% -8%, rgba(90,215,255,0.18) 0%, rgba(10,16,26,0) 40%), radial-gradient(circle at 95% 12%, rgba(141,255,186,0.15) 0%, rgba(10,16,26,0) 33%), #090f19",
      }}
    >
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: "1px solid rgba(145,163,190,0.2)",
          backdropFilter: "blur(12px)",
          background: "rgba(9, 15, 25, 0.88)",
          zIndex: 1100,
        }}
      >
        <Toolbar
          variant="dense"
          sx={{
            minHeight: "56px !important",
            px: { xs: 2.2, md: 3.2 },
            display: "flex",
            alignItems: "center",
            gap: 1.2,
          }}
        >
          <AutoAwesomeRounded color="primary" fontSize="small" />
          <Typography
            variant="overline"
            color="primary.light"
            sx={{ letterSpacing: 1.2, fontWeight: 700, mt: 0.2 }}
          >
            Quantum Notebook Studio
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            href="https://github.com/paul-soporan/quantum-notebook-studio"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            color="inherit"
            sx={{ opacity: 0.8, "&:hover": { opacity: 1 } }}
          >
            <GitHub fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Toolbar variant="dense" sx={{ minHeight: "56px !important", mb: 2 }} />

      <Container maxWidth="lg" sx={{ mb: 3 }}>
        <Stack spacing={3.2}>
          <Box sx={{ p: { xs: 1, md: 2 }, textAlign: "center" }}>
            <Stack spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="h3" sx={{ fontSize: { xs: "1.7rem", md: "2.5rem" }, fontWeight: 700 }}>
                Choose A Quantum Algorithm Notebook
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 880, fontSize: "1.1rem", lineHeight: 1.6 }}>
                Explore interactive quantum computing experiments and visualizations.
                Each notebook includes context, theory, and runnable code.
              </Typography>
            </Stack>
          </Box>

          <Grid container spacing={3} sx={{ justifyContent: "center" }}>
            {NOTEBOOK_CATALOG.map((entry) => (
              <Grid key={entry.id} size={{ xs: 12, md: 6 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    px: 3.2,
                    py: 3,
                    height: "100%",
                    borderColor: "rgba(145,163,190,0.2)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.2,
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{entry.title}</Typography>
                  
                  <Typography variant="subtitle1" color="text.secondary" sx={{ fontStyle: "italic", opacity: 0.85, lineHeight: 1.4 }}>
                    {entry.subtitle}
                  </Typography>

                  <Typography variant="body1" color="text.secondary" sx={{ flexGrow: 1, lineHeight: 1.6 }}>
                    {entry.description}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                    {entry.tags.map((tag) => (
                      <Chip key={`${entry.id}-${tag}`} label={tag} size="small" sx={{ bgcolor: "rgba(145,163,190,0.08)" }} />
                    ))}
                  </Stack>

                  <Box sx={{ mt: 1 }}>
                    <Button
                      component={Link}
                      href={`/notebook/${entry.id}`}
                      variant="contained"
                      fullWidth
                      size="large"
                      endIcon={<ArrowForwardRounded />}
                    >
                      Open Notebook
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>

      <AppFooter />
    </Box>
  );
}
