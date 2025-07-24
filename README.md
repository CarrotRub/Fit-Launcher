# 🎮 Fit Launcher

Fit Launcher is a 🚀 **blazingly fast** 🚀 (sorry it's made in rust, I have to write that) game launcher designed specifically for cracked games from FitGirl Repack. Built with Rust, Tauri, and SolidJS, this launcher delivers the best performance and a sleek, modern design. 

## Features
- ⚡ **Lightning Fast**: Powered by Rust and Tauri for better speed and efficiency.
- 🛠️ **Easy to Use**: Simple setup and easy to run—just execute the launcher and you're good to go!
- 🌌 **Quick Download**: Using **aria2c** for torrenting and DDL for optimal speed.

## Getting Started

### Images of the launcher

![Launcher Screenshot 1](images/1.png)
![Launcher Screenshot 2](images/2.png)
![Launcher Screenshot 3](images/3.png)
![Launcher Screenshot 4](images/4.png)
![Launcher Screenshot 5](images/5.png)
![Launcher Screenshot 6](images/6.png)
![Launcher Screenshot 7](images/7.png)
![Launcher Screenshot 8](images/8.png)

## Installation Guide

### Standard Mode

1. **Visit the Release Page**  
   Go to the [release page here](https://github.com/CarrotRub/Fit-Launcher/releases/latest).

2. **Download the Executable**  
   Scroll down until you find the executable, which will look like this `Fit.Launcher_3.X.X_x64_en-US.msi`

3. **Run it !**
   Once downloaded, simply execute the setup and install it inside
   `C:/Program Files/` then run the executable :) !

### Development Mode

If you want to run the launcher in development mode, follow these steps:

1. Ensure you have any **C++ Compiler**, **Rust**, and **Cargo** installed on your system.
2. Ensure you have these extensions on VSCode **C/C++ Microsoft** or **CodeLLDB** and **rust-analyzer**.
3. Clone this repository.
4. Run the dev command:

```bash
npm install
npm run tauri dev
```

### Building from Source

If you'd like to build Fit Launcher yourself, follow these steps:

1. Ensure you have any **C++ Compiler**, **Rust**, and **Cargo** installed on your system.
2. Ensure you have these extensions on VSCode **C/C++ Microsoft** or **CodeLLDB** and **rust-analyzer**.
3. Clone this repository.
4. Run the build command:

```bash
npm run tauri build
```

## Create your own themes !
Now you can even customize the launcher to your liking, you can go check the tutorial on how to create a theme in doc/theme_creation.md

![Launcher Screenshot 1](images/themes/1.png)
![Launcher Screenshot 2](images/themes/2.png)
![Launcher Screenshot 3](images/themes/3.png)
![Launcher Screenshot 4](images/themes/4.png)
![Launcher Screenshot 5](images/themes/5.png)

*The last one is a special theme, come on Discord to get it*

Here are a few of the default themes !
You can then create as much as you want.
Good luck !!

## Join Our Community 🎉

Got questions or want to hang out with our users? Join us on Discord! Big thanks to **Kürst** for moderating our Discord server, to **mokurin** for helping me tremendously with the many and most issues in the backend and to **SimplyStoned** for maintaining the old launcher while I was developing this one.

[Join the Discord](https://discord.gg/cXaBWdcUSF)

## Credits

- **CarrotRub** - Me, Developer of this app (Design now too) :3.
- **mokurin000** - Main Contributor.
- **Kürst** - Discord Moderator and Technical and Visual Co-Contributor
- **Vintage_Soldier** - First App Design (Old design).
- **SimplyStoned** - Maintenance of the Old Launcher and Contributor.

---

Enjoy your games with Fit Launcher!

## TODO List 📝

- 🖥️ **Better Cross-Platform Compatibility**: Improve compatibility across different operating systems.
- 🌄 **Quicker Image Loading**: Optimize the speed at which images are retrieved and displayed.
- 🎮 **Filtering by Genres and Sizes**: Implement filters to sort games by genres and file sizes.
- 📟 **Control CPU Usage**: Allow the user to limit the CPU usage of the setup.
