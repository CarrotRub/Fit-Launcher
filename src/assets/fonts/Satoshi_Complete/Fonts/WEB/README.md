# Installing Webfonts
Follow these simple Steps.

## 1.
Put `satoshi/` Folder into a Folder called `fonts/`.

## 2.
Put `satoshi.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `satoshi.css` depends on your Website Filesystem.

## 4.
Import `satoshi.css` at the top of you main Stylesheet.

```
@import url('satoshi.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Satoshi-Light;
font-family: Satoshi-LightItalic;
font-family: Satoshi-Regular;
font-family: Satoshi-Italic;
font-family: Satoshi-Medium;
font-family: Satoshi-MediumItalic;
font-family: Satoshi-Bold;
font-family: Satoshi-BoldItalic;
font-family: Satoshi-Black;
font-family: Satoshi-BlackItalic;
font-family: Satoshi-Variable;
font-family: Satoshi-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 900.0

Available axes:
'wght' (range from 300.0 to 900.0

