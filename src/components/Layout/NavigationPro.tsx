import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme as useAppTheme } from "../../contexts/ThemeContext";
import { extractDisplayName } from "../../utils/nameUtils";
import LanguageSwitcher from "../LanguageSwitcher";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Typography,
  Drawer,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Divider,
  useTheme,
  useMediaQuery,
  Avatar,
  Backdrop,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from "@mui/icons-material";

const NavigationPro: React.FC = () => {
  const { isLoggedIn, logout, user } = useAuth();
  const { isDarkMode } = useAppTheme();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  // Navigation items configuration - only show appropriate items based on auth status
  const navItems = isLoggedIn()
    ? [
        { path: "/dashboard", label: t("nav.dashboard"), icon: "fa-chart-line", emoji: "📊" },
        { path: "/mood-tracker", label: t("nav.mood"), icon: "fa-smile", emoji: "😊" },
        { path: "/referral", label: t("nav.referral"), icon: "fa-users", emoji: "👥", highlight: true },
        { path: "/health-sync", label: t("nav.health"), icon: "fa-heartbeat", emoji: "❤️" },
      ]
    : [
        { path: "/", label: t("nav.home"), icon: "fa-home", emoji: "🏠" },
      ];

  // Bottom tabs for mobile (simpler navigation) - only show appropriate tabs based on auth status
  const tabs = isLoggedIn()
    ? [
        { id: "dashboard", path: "/dashboard", label: t("nav.dashboard"), icon: "📊" },
        { id: "mood", path: "/mood-tracker", label: t("nav.mood"), icon: "😊" },
        { id: "referral", path: "/referral", label: t("nav.referral"), icon: "👥" },
      ]
    : [
        { id: "home", path: "/", label: t("nav.home"), icon: "🏠" },
      ];

  return (
    <>
      {/* Desktop Navigation - Top Bar */}
      <AppBar
        position="fixed"
        elevation={scrolled ? 4 : 1}
        sx={{
          display: { xs: "none", md: "block" },
          transition: "all 0.3s ease",
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar
          sx={{
            maxWidth: "1200px",
            width: "100%",
            mx: "auto",
            px: 3,
          }}
        >
          {/* Logo */}
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{
              color: "text.primary",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              textDecoration: "none",
              transition: "all 0.2s",
              "&:hover": {
                color: "primary.main",
              },
            }}
          >
            <span style={{ fontSize: "1.75rem" }}>🧠</span>
            Lugn & Trygg
          </Typography>

          {/* Desktop Navigation Items */}
          <Box
            sx={{
              display: { xs: "none", lg: "flex" },
              alignItems: "center",
              gap: 1,
              ml: "auto",
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: "medium",
                  transition: "all 0.2s",
                  ...(isActive(item.path)
                    ? item.highlight
                      ? {
                          background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                          color: "white",
                          boxShadow: 2,
                          "&:hover": {
                            boxShadow: 3,
                          },
                        }
                      : {
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          boxShadow: 2,
                          "&:hover": {
                            bgcolor: "primary.dark",
                          },
                        }
                    : {
                        color: "text.primary",
                        "&:hover": {
                          bgcolor: "action.hover",
                          color: "primary.main",
                        },
                      }),
                }}
              >
                {item.emoji ? (
                  <span style={{ fontSize: "1.125rem", marginRight: "0.5rem" }}>{item.emoji}</span>
                ) : (
                  <i
                    className={`fas ${item.icon}`}
                    style={{
                      marginRight: "0.5rem",
                      color: item.highlight && isActive(item.path) ? "#fef3c7" : undefined,
                    }}
                  />
                )}
                <span>{item.label}</span>
              </Button>
            ))}

            {/* User Info (Desktop) */}
            {isLoggedIn() && (
              <Box
                sx={{
                  display: { xs: "none", xl: "flex" },
                  alignItems: "center",
                  gap: 1,
                  bgcolor: "grey.100",
                  color: "grey.700",
                  px: 1.5,
                  py: 1,
                  borderRadius: "24px",
                  fontSize: "0.875rem",
                  ml: 1,
                }}
              >
                <i className="fas fa-user" style={{ color: theme.palette.primary.main }}></i>
                <span>Hej, {extractDisplayName(user?.email || "")}</span>
              </Box>
            )}

            {/* Theme Toggle */}
            <Box sx={{ ml: 1 }}>
              <ThemeToggle />
            </Box>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Logout Button (Desktop) */}
            {isLoggedIn() && (
              <Button
                onClick={logout}
                variant="contained"
                color="error"
                size="small"
                sx={{ ml: 1 }}
              >
                <i className="fas fa-sign-out-alt" style={{ marginRight: "0.5rem" }}></i>
                <Box component="span" sx={{ display: { xs: "none", xl: "inline" } }}>
                  {t("nav.logout")}
                </Box>
              </Button>
            )}
          </Box>

          {/* Mobile Menu Button */}
          <IconButton
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            sx={{
              display: { md: "block", lg: "none" },
              ml: "auto",
            }}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile: Bottom Tab Bar - Mobile-First UX */}
      <Paper
        elevation={3}
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar,
        }}
      >
        <BottomNavigation
          value={location.pathname}
          sx={{
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          {tabs.map((tab) => (
            <BottomNavigationAction
              key={tab.id}
              component={Link}
              to={tab.path}
              value={tab.path}
              icon={<span style={{ fontSize: "1.5rem" }}>{tab.icon}</span>}
              label={
                <Typography variant="caption" fontWeight="medium">
                  {tab.label}
                </Typography>
              }
              sx={{
                py: 1.5,
                px: 2,
                borderRadius: 3,
                transition: "all 0.2s",
                minWidth: 0,
                flex: 1,
                ...(isActive(tab.path)
                  ? {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      boxShadow: 2,
                      "& .MuiBottomNavigationAction-label": {
                        color: "primary.contrastText",
                      },
                    }
                  : {
                      color: "text.secondary",
                      "&:hover": {
                        color: "primary.main",
                        bgcolor: "action.hover",
                      },
                    }),
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {/* Mobile Menu Backdrop */}
      <Backdrop
        open={mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
        sx={{
          display: { lg: "none" },
          zIndex: theme.zIndex.drawer - 1,
        }}
      />

      {/* Mobile Menu Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: "100%",
            maxWidth: "400px",
            p: 3,
          },
        }}
        sx={{
          display: { lg: "none" },
        }}
      >
        {/* Close Button */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <IconButton
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* User Info (Mobile) */}
        {isLoggedIn() && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              bgcolor: "grey.50",
              p: 2,
              borderRadius: 3,
              mb: 3,
            }}
          >
            <Avatar
              sx={{
                width: 48,
                height: 48,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              <i className="fas fa-user" style={{ color: "white", fontSize: "1.25rem" }}></i>
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight="medium" color="text.primary">
                Hej,
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {extractDisplayName(user?.email || "")}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Mobile Nav Items */}
        <Box component="nav" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              fullWidth
              sx={{
                justifyContent: "flex-start",
                px: 2,
                py: 1.5,
                borderRadius: 3,
                fontWeight: "medium",
                transition: "all 0.2s",
                ...(isActive(item.path)
                  ? item.highlight
                    ? {
                        background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                        color: "white",
                        boxShadow: 2,
                      }
                    : {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        boxShadow: 2,
                      }
                  : {
                      color: "text.primary",
                      "&:hover": {
                        color: "primary.contrastText",
                        bgcolor: "grey.800",
                      },
                    }),
              }}
            >
              {item.emoji ? (
                <span style={{ fontSize: "1.5rem", marginRight: "0.75rem" }}>{item.emoji}</span>
              ) : (
                <i
                  className={`fas ${item.icon}`}
                  style={{
                    fontSize: "1.125rem",
                    marginRight: "0.75rem",
                    color: item.highlight && isActive(item.path) ? "#fef3c7" : undefined,
                  }}
                />
              )}
              <span style={{ fontSize: "1rem" }}>{item.label}</span>
              {isActive(item.path) && (
                <CheckIcon sx={{ ml: "auto", fontSize: "0.875rem" }} />
              )}
            </Button>
          ))}
        </Box>

        {/* Mobile Actions */}
        <Box sx={{ pt: 3, mt: 3, borderTop: 1, borderColor: "divider" }}>
          {/* Theme Toggle */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <ThemeToggle />
          </Box>

          {/* Language Switcher */}
          <Box sx={{ px: 2 }}>
            <LanguageSwitcher />
          </Box>

          {/* Logout Button (Mobile) */}
          {isLoggedIn() && (
            <Button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              fullWidth
              variant="contained"
              color="error"
              sx={{ mt: 1.5 }}
            >
              <i className="fas fa-sign-out-alt" style={{ marginRight: "0.5rem" }}></i>
              <span>{t("nav.logout")}</span>
            </Button>
          )}
        </Box>
      </Drawer>

      {/* Spacer to prevent content from hiding under fixed nav */}
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          height: "64px",
        }}
        aria-hidden="true"
      />
      <Box
        sx={{
          display: { xs: "block", md: "none" },
          height: "80px",
        }}
        aria-hidden="true"
      />
    </>
  );
};

export default NavigationPro;
