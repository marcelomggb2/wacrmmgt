import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mobile App",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#075e54",
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
