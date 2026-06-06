import { Box, Typography } from "@mui/material";

export function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 3,
        borderTop: "1px solid rgba(145,163,190,0.1)",
        textAlign: "center",
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
        &copy; {new Date().getFullYear()} Paul Soporan. All rights reserved.
      </Typography>
    </Box>
  );
}
