import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: ["./src/**/*.{vector-maps,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Satoshi"', ...defaultTheme.fontFamily.sans],
      },
      screens: {
        "2xsm": "375px",
        xsm: "425px",
        "3xl": "2000px",
      },

      // PALETTE:
      // - Light theme: base bianca + verdi pastello/tech
      // - Dark theme: base nera + verdi fluo/tech (ancora più fluo)
      colors: {
        current: "currentColor",
        transparent: "transparent",

        white: "#FFFFFF",
        black: "#020617",

        // Primary tech green condiviso
        primary: "#2CD673",          // green tech principale (più soft per il light)
        "primary-soft": "#E6FFF6",   // bg pill / badge soft
        "primary-strong": "#10B981", // accent forte

        stroke: "#CBEAD8",           // bordi chiari (light)
        "stroke-dark": "#00FF6E",    // bordi/accent in dark super fluo

        // LIGHT THEME — base bianca + verdi pastello/tech
        light: {
          background: "#FFFFFF",    // bg principale bianco
          surface: "#F4FBF7",       // card/chips soft
          "surface-alt": "#E8F5ED", // layer secondario
          muted: "#D6EBDD",         // bg per tag mutati
          border: "#C5E3D1",        // bordi soft
          accent: "#B2DDC9",        // piccoli accent
          "accent-soft": "#E6FFF6",
          text: "#123326",          // testo principale
          "text-soft": "#4F7C66",   // testo attenuato
        },

        // DARK THEME — base nera + verdi fluo/tech
        dark: {
          DEFAULT: "#020617",   // bg principale quasi nero
          2: "#030712",
          3: "#020817",
          4: "#020914",
          5: "#6EE7B7",         // testo attenuato / icone
          6: "#A7F3D0",
          7: "#ECFDF5",
          8: "#000000",

          background: "#020617",
          surface: "#020814",        // card/scaffold
          "surface-alt": "#020B17",  // layer secondario
          muted: "#01110D",          // bg elementi disattivati
          border: "#00FF6E",         // bordi fluo
          accent: "#00FF9D",         // verde fluo principale
          "accent-soft": "#01251B",  // alone fluo molto scuro
          text: "#ECFDF5",           // testo principale in dark
          "text-soft": "#A7F3D0",    // testo attenuato in dark
        },

        // BASE CHIARA: verdi freddi/pastello per superfici
        gray: {
          DEFAULT: "#F4FBF7",          // surface principale (fredda/pastello)
          dark: "rgba(4,7,8,0.65)",    // testo attenuato in light
          1: "#E8F5ED",                // layer secondario
          2: "#DCF0E4",                // separatori / pattern
          3: "#CBEAD8",                // bordi soft
          4: "#B7E0C9",
          5: "#A0D4B8",
          6: "#7FBF9E",
          7: "#123326",                // testo forte su light
        },

        // Verde stato/OK (light = pastello, neon = hi-tech)
        green: {
          DEFAULT: "#22C55E",
          dark: "#15803D",
          light: {
            DEFAULT: "#2CD673",
            1: "#22C55E",
            2: "#57DE8F",
            3: "#82E6AC",
            4: "#ACEFC8",
            5: "#C2F3D6",
            6: "#DAF8E6",
            7: "#E9FBF0",
          },
          // Hi-Tech / fluo (ancora più sparato per il dark)
          neon: {
            DEFAULT: "#00FF9D",
            2: "#00FF6E",
            3: "#20FFC2",
            4: "#7CFFDA",
            5: "#E6FFF9",
          },
        },

        // Rosso errori
        red: {
          DEFAULT: "#E24D4D",
          dark: "#C53A3A",
          light: {
            DEFAULT: "#F56060",
            2: "#F89090",
            3: "#FBC0C0",
            4: "#FDD8D8",
            5: "#FEEBEB",
            6: "#FEF3F3",
          },
        },

        // Blu di sistema (rimane secondario per info)
        blue: {
          DEFAULT: "#1C2F4A",
          dark: "#13223A",
          light: {
            DEFAULT: "#274062",
            2: "#3D5779",
            3: "#5E7A98",
            4: "#89A1B7",
            5: "#D2E2EF",
          },
        },

        // Giallo tenue per warning
        yellow: {
          dark: {
            DEFAULT: "#D97706",
            2: "#B45309",
          },
          light: {
            DEFAULT: "#F7C440",
            4: "#FFF7E6",
          },
        },
      },

      // Tipografie: invariato
      fontSize: {
        "heading-1": ["60px", "72px"],
        "heading-2": ["48px", "58px"],
        "heading-3": ["40px", "48px"],
        "heading-4": ["35px", "45px"],
        "heading-5": ["28px", "40px"],
        "heading-6": ["24px", "30px"],
        "body-2xlg": ["22px", "28px"],
        "body-sm": ["14px", "22px"],
        "body-xs": ["12px", "20px"],
      },

      // Spaziature: invariato
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        6.5: "1.625rem",
        7.5: "1.875rem",
        8.5: "2.125rem",
        9.5: "2.375rem",
        10.5: "2.625rem",
        11: "2.75rem",
        11.5: "2.875rem",
        12.5: "3.125rem",
        13: "3.25rem",
        13.5: "3.375rem",
        14: "3.5rem",
        14.5: "3.625rem",
        15: "3.75rem",
        15.5: "3.875rem",
        16: "4rem",
        16.5: "4.125rem",
        17: "4.25rem",
        17.5: "4.375rem",
        18: "4.5rem",
        18.5: "4.625rem",
        19: "4.75rem",
        19.5: "4.875rem",
        21: "5.25rem",
        21.5: "5.375rem",
        22: "5.5rem",
        22.5: "5.625rem",
        24.5: "6.125rem",
        25: "6.25rem",
        25.5: "6.375rem",
        26: "6.5rem",
        27: "6.75rem",
        27.5: "6.875rem",
        28.5: "7.125rem",
        29: "7.25rem",
        29.5: "7.375rem",
        30: "7.5rem",
        31: "7.75rem",
        32.5: "8.125rem",
        33: "8.25rem",
        34: "8.5rem",
        34.5: "8.625rem",
        35: "8.75rem",
        36.5: "9.125rem",
        37.5: "9.375rem",
        39: "9.75rem",
        39.5: "9.875rem",
        40: "10rem",
        42.5: "10.625rem",
        44: "11rem",
        45: "11.25rem",
        46: "11.5rem",
        46.5: "11.625rem",
        47.5: "11.875rem",
        49: "12.25rem",
        50: "12.5rem",
        52: "13rem",
        52.5: "13.125rem",
        54: "13.5rem",
        54.5: "13.625rem",
        55: "13.75rem",
        55.5: "13.875rem",
        59: "14.75rem",
        60: "15rem",
        62.5: "15.625rem",
        65: "16.25rem",
        67: "16.75rem",
        67.5: "16.875rem",
        70: "17.5rem",
        72.5: "18.125rem",
        73: "18.25rem",
        75: "18.75rem",
        90: "22.5rem",
        94: "23.5rem",
        95: "23.75rem",
        100: "25rem",
        103: "25.75rem",
        115: "28.75rem",
        125: "31.25rem",
        132.5: "33.125rem",
        150: "37.5rem",
        171.5: "42.875rem",
        180: "45rem",
        187.5: "46.875rem",
        203: "50.75rem",
        230: "57.5rem",
        242.5: "60.625rem",
      },

      maxWidth: {
        2.5: "0.625rem",
        3: "0.75rem",
        4: "1rem",
        7: "1.75rem",
        9: "2.25rem",
        10: "2.5rem",
        10.5: "2.625rem",
        11: "2.75rem",
        13: "3.25rem",
        14: "3.5rem",
        15: "3.75rem",
        16: "4rem",
        22.5: "5.625rem",
        25: "6.25rem",
        30: "7.5rem",
        34: "8.5rem",
        35: "8.75rem",
        40: "10rem",
        42.5: "10.625rem",
        44: "11rem",
        45: "11.25rem",
        46.5: "11.625rem",
        60: "15rem",
        70: "17.5rem",
        90: "22.5rem",
        94: "23.5rem",
        100: "25rem",
        103: "25.75rem",
        125: "31.25rem",
        132.5: "33.125rem",
        142.5: "35.625rem",
        150: "37.5rem",
        180: "45rem",
        203: "50.75rem",
        230: "57.5rem",
        242.5: "60.625rem",
        270: "67.5rem",
        280: "70rem",
        292.5: "73.125rem",
      },

      maxHeight: {
        35: "8.75rem",
        70: "17.5rem",
        90: "22.5rem",
        550: "34.375rem",
        300: "18.75rem",
      },

      minWidth: {
        22.5: "5.625rem",
        42.5: "10.625rem",
        47.5: "11.875rem",
        75: "18.75rem",
      },

      zIndex: {
        999999: "999999",
        99999: "99999",
        9999: "9999",
        999: "999",
        99: "99",
        9: "9",
        1: "1",
      },

      opacity: {
        65: ".65",
      },

      aspectRatio: {
        "4/3": "4 / 3",
        "21/9": "21 / 9",
      },

      backgroundImage: {
        video: "url('../images/video/video.png')",
        // Gradient Hi-Tech (abbinati alle nuove palette verdi)
        "gradient-green-neon":
          "linear-gradient(90deg, #00FF9D 0%, #00FF6E 50%, #2CD673 100%)",
        "gradient-green-neon-soft":
          "linear-gradient(90deg, #E6FFF6 0%, #7CFFDA 50%, #20FFC2 100%)",
        "gradient-primary-corporate":
          "linear-gradient(90deg, #2CD673 0%, #22C55E 50%, #16A34A 100%)",
      },

      content: {
        "icon-copy": 'url("../images/icon/icon-copy-alt.svg")',
      },

      transitionProperty: { width: "width", stroke: "stroke" },

      borderWidth: {
        6: "6px",
        10: "10px",
        12: "12px",
      },

      // Bordi netti, moderni
      borderRadius: {
        none: "0",
        DEFAULT: "0.375rem", // 6px
        md: "0.5rem",        // 8px
        lg: "0.75rem",       // 12px
        xl: "1rem",          // 16px
        "2xl": "1.25rem",    // 20px
      },

      // Ombre: adattate ai nuovi toni
      boxShadow: {
        default: "0 1px 2px 0 rgba(4, 7, 8, 0.10)",
        error:   "0 6px 20px 0 rgba(226, 77, 77, 0.18)",
        card:    "0 1px 2px 0 rgba(4, 7, 8, 0.10)",
        "card-2":"0 2px 6px -1px rgba(4,7,8,0.12)",
        "card-3":"0 2px 4px 0 rgba(4,7,8,0.14)",
        "card-4":"0 1px 3px 0 rgba(4,7,8,0.16)",
        "card-5":"0 2px 8px 0 rgba(4,7,8,0.12)",
        "card-6":"0 3px 10px 0 rgba(4,7,8,0.12)",
        "card-7":"0 2px 6px 0 rgba(4,7,8,0.14)",
        "card-8":"0 1px 3px 0 rgba(4,7,8,0.12)",
        "card-9":"0 1px 3px 0 rgba(4,7,8,0.10)",
        "card-10":"0 2px 3px 0 rgba(4,7,8,0.12)",
        switcher: "0 1px 2px rgba(4,7,8,0.12), inset 0 1px 1px #FFFFFF, inset 0 -1px 1px rgba(4,7,8,0.06)",
        "switch-1":"0 0 2px 0 rgba(0,255,158,0.30)",
        "switch-2":"0 0 6px 0 rgba(0,255,110,0.45)",
        datepicker: "-5px 0 0 #020617, 5px 0 0 #020617",
        1: "0 1px 2px 0 rgba(4,7,8,0.12)",
        2: "0 2px 3px 0 rgba(4,7,8,0.14)",
        3: "0 8px 16px 0 rgba(4,7,8,0.10)",
        4: "0 12px 32px 0 rgba(4,7,8,0.14)",
        5: "0 10px 30px 0 rgba(4,7,8,0.14)",
        6: "0 12px 34px 0 rgba(4,7,8,0.12), 0 34px 26px 0 rgba(4,7,8,0.08)",
        7: "0 18px 25px 0 rgba(4,7,8,0.10)",
      },

      dropShadow: {
        card: "0 8px 13px rgba(4, 7, 8, 0.08)",
        1: "0 1px 0 #CBEAD8",
        2: "0 1px 4px rgba(4, 7, 8, 0.14)",
        3: "0 0 4px rgba(4, 7, 8, 0.18)",
        4: "0 0 2px rgba(4, 7, 8, 0.22)",
        5: "0 1px 5px rgba(4, 7, 8, 0.22)",
      },

      keyframes: {
        linspin: { "100%": { transform: "rotate(360deg)" } },
        easespin: {
          "12.5%": { transform: "rotate(135deg)" },
          "25%": { transform: "rotate(270deg)" },
          "37.5%": { transform: "rotate(405deg)" },
          "50%": { transform: "rotate(540deg)" },
          "62.5%": { transform: "rotate(675deg)" },
          "75%": { transform: "rotate(810deg)" },
          "87.5%": { transform: "rotate(945deg)" },
          "100%": { transform: "rotate(1080deg)" },
        },
        "left-spin": {
          "0%": { transform: "rotate(130deg)" },
          "50%": { transform: "rotate(-5deg)" },
          "100%": { transform: "rotate(130deg)" },
        },
        "right-spin": {
          "0%": { transform: "rotate(-130deg)" },
          "50%": { transform: "rotate(5deg)" },
          "100%": { transform: "rotate(-130deg)" },
        },
        rotating: {
          "0%, 100%": { transform: "rotate(360deg)" },
          "50%": { transform: "rotate(0deg)" },
        },
        topbottom: {
          "0%, 100%": { transform: "translate3d(0, -100%, 0)" },
          "50%": { transform: "translate3d(0, 0, 0)" },
        },
        bottomtop: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -100%, 0)" },
        },
        line: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(100%)" },
        },
        "line-revert": {
          "0%, 100%": { transform: "translateY(100%)" },
          "50%": { transform: "translateY(0)" },
        },
      },

      animation: {
        linspin: "linspin 1568.2353ms linear infinite",
        easespin: "easespin 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "left-spin": "left-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "right-spin": "right-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "ping-once": "ping 5s cubic-bezier(0, 0, 0.2, 1)",
        rotating: "rotating 30s linear infinite",
        topbottom: "topbottom 60s infinite alternate linear",
        bottomtop: "bottomtop 60s infinite alternate linear",
        "spin-1.5": "spin 1.5s linear infinite",
        "spin-2": "spin 2s linear infinite",
        "spin-3": "spin 3s linear infinite",
        line1: "line 10s infinite linear",
        line2: "line-revert 8s infinite linear",
        line3: "line 7s infinite linear",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
