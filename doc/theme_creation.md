# FitLauncher Theme Creation Guide

This guide explains how to create custom themes for **FitLauncher** using CSS. Themes allow you to customize the look and feel of the launcher by defining a set of colors and styles.

---

## 1. What is a Theme?

A theme is a set of CSS variables defined for the `:root` selector. These variables control various aspects of the UI, such as text color, background color, accent color, and more. Themes are applied dynamically by setting the `data-theme` attribute on the `<html>` or `:root` element.

---

## 2. Structure of a Theme

Each theme consists of CSS variables that define colors for:
- **Accent Color:** Highlighted elements.
- **Primary Color:** Main UI elements.
- **Secondary Color:** Supporting elements.
- **Background Color:** Base UI background.
- **Popup Background Color:** For Popups and some elements.
- **Text Color:** Default text color.
- **Transparency Levels:** Variants of colors with transparency.

---

## 3. Creating a Theme

1. **Create a CSS File:**  
   Start by creating a new CSS file, e.g., `my-theme.css`.

2. **Define Variables in `:root`:**  
   Use the following template as a starting point for your theme:

   Example of Blue Cyan Theme : 
   ```css
      :root[data-theme="blue-cyan"] {
        --color-accent: rgba(0, 128, 128, 1);
        --color-primary: rgba(64, 224, 208, 1);
        --color-secondary: rgba(0, 102, 102, 1);
        --color-secondary-30: rgba(0, 102, 102, 0.3);
        --color-secondary-20: rgba(0, 102, 102, 0.2);
        --color-text: rgba(240, 255, 255, 1);
        --color-muted: rgba(200, 240, 240, 0.5);
        --color-background: rgba(10, 20, 25, 1);
        --color-background-70: rgba(10, 20, 25, 0.7);
        --color-background-30: rgba(10, 20, 25, 0.3);
        --color-popup-background: rgba(5, 15, 20, 1);
        --color-resume-accent: rgba(0, 204, 204, 1);
        --color-warning-orange: rgba(255, 127, 80, 1);
      }

    ```

### Copiable Example :
   ```css
      :root[data-theme="your-theme-name"] {
        --color-accent: /* Value here (rgba) ! */;
        --color-primary: /* Value here (rgba) ! */;
        --color-secondary: /* Value here (rgba) ! */;
        --color-secondary-30: /* Value here (rgba) ! */;
        --color-secondary-20: /* Value here (rgba) ! */;
        --color-text: /* Value here (rgba) ! */;
        --color-muted: /* Value here (rgba) ! */;
        --color-background: /* Value here (rgba) ! */;
        --color-background-70: /* Value here (rgba) ! */;
        --color-background-30: /* Value here (rgba) ! */;
        --color-popup-background: /* Value here (rgba) ! */;
        --color-resume-accent: /* Value here (rgba) ! */;
        --color-warning-orange: /* Value here (rgba) ! */;
      }

  ```
### Tips :
I would personally recommend you to build the app in dev mode to be able to try multiple colors in real time instead of modifying the file each time.