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
- **Text Color:** Default text color.
- **Popup Background Color:** Background for modal elements.
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
          --accent-color: rgba(0, 128, 128, 1);
          --secondary-color: rgba(0, 102, 102, 1);
          --secondary-30-selected-color: rgba(0, 102, 102, 0.3);
          --non-selected-text-color: rgba(200, 240, 240, 0.5);
          --primary-color: rgba(64, 224, 208, 1);
          --secondary-20-color: rgba(0, 102, 102, 0.2);
          --text-color: rgba(240, 255, 255, 1);
          --background-color: rgb(10, 20, 25);
          --70-background-color: rgba(10, 20, 25, 0.7);
          --30-background-color: rgba(10, 20, 25, 0.3);
          --popup-background-color: rgb(5, 15, 20);
          --resume-button-accent-color: #00CCCC;
          --warning-orange: #FF7F50;
        }

    ```

### Copiable Example :
   ```css
        :root[data-theme="your-theme-name"] {
          --accent-color: ;
          --secondary-color: ;
          --secondary-30-selected-color: ;
          --non-selected-text-color: ;
          --primary-color: ;
          --secondary-20-color: ;
          --text-color: ;
          --background-color: ;
          --70-background-color: ;
          --30-background-color: ;
          --popup-background-color: ;
          --resume-button-accent-color: ;
          --warning-orange: ;
        }

  ```
### Tips :
I would personally recommend you to build the app in dev mode to be able to try multiple colors in real time instead of modifying the file each time.