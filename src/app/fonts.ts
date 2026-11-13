// Every font is self-hosted from Fontsource packages in node_modules, so `next build` never reaches Google Fonts
// (the Docker build used to fail with ETIMEDOUT to fonts.googleapis.com). Each face uses font-display: swap.
// The weights and subsets match what next/font/google loaded before; fonts.css sets the same CSS variables.

// Variable fonts: one file per subset covers every weight. A browser only downloads the subsets a page uses.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/google-sans-flex/wght.css";
import "@fontsource-variable/open-sans/wght.css";
import "@fontsource-variable/montserrat/wght.css";
import "@fontsource-variable/source-sans-3/wght.css";
import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/work-sans/wght.css";
import "@fontsource-variable/kantumruy-pro/wght.css";

// Static fonts: only the weights and subsets in use.
import "@fontsource/poppins/latin-300.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";

import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";

import "@fontsource/lato/latin-300.css";
import "@fontsource/lato/latin-400.css";
import "@fontsource/lato/latin-700.css";
import "@fontsource/lato/latin-900.css";

import "@fontsource/koh-santepheap/khmer-100.css";
import "@fontsource/koh-santepheap/latin-100.css";
import "@fontsource/koh-santepheap/khmer-300.css";
import "@fontsource/koh-santepheap/latin-300.css";
import "@fontsource/koh-santepheap/khmer-400.css";
import "@fontsource/koh-santepheap/latin-400.css";
import "@fontsource/koh-santepheap/khmer-700.css";
import "@fontsource/koh-santepheap/latin-700.css";
import "@fontsource/koh-santepheap/khmer-900.css";
import "@fontsource/koh-santepheap/latin-900.css";

import "@fontsource/battambang/khmer-100.css";
import "@fontsource/battambang/latin-100.css";
import "@fontsource/battambang/khmer-300.css";
import "@fontsource/battambang/latin-300.css";
import "@fontsource/battambang/khmer-400.css";
import "@fontsource/battambang/latin-400.css";
import "@fontsource/battambang/khmer-700.css";
import "@fontsource/battambang/latin-700.css";
import "@fontsource/battambang/khmer-900.css";
import "@fontsource/battambang/latin-900.css";

import "@fontsource/siemreap/khmer-400.css";

import "@fontsource/dangrek/khmer-400.css";

import "@fontsource/noto-sans-khmer/khmer-400.css";
import "@fontsource/noto-sans-khmer/khmer-500.css";
import "@fontsource/noto-sans-khmer/khmer-600.css";
import "@fontsource/noto-sans-khmer/khmer-700.css";

import "./fonts.css";
