import { createEffect, onMount } from "solid-js";
import { A } from "@solidjs/router";
import './Topbar.css'

function Topbar() {

    return (
        <div className='top-bar-container'>
            <img id='fitgirl-logo' src='./Square310x310Logo.png' alt='fitgirl repack logo' />
            
            <div className='search-bar'>
                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="-543 241.4 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g data-testid="search"><g class="fills"><rect rx="0" ry="0" x="-543" y="241.4" width="24" height="24" class="frame-background"/></g><g class="frame-children"><g data-testid="svg-circle"><circle cx="-532" cy="252.4" style="fill:none" class="fills" r="8"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="-532" cy="252.4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape" r="8"/></g></g><g data-testid="svg-path"><path d="m-522 262.4-4.3-4.3" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m-522 262.4-4.3-4.3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></g></g></svg>
                <input type='text' placeholder='Search Game'/>
            </div>
            
            <A href="/" class="clickable-link active" link="" aria-current="page">
                <p id="link-gamehub" className="links-texts">GameHub</p>
            </A>

            <A href="/library" className="clickable-link active" link="" aria-current="page">
                <p id="link-library" className="links-texts">Library</p>
            </A>
            
            <A href="/downloads" className="clickable-link active" link="" aria-current="page">
                <p id="link-downloads" className="links-texts">Downloads</p>
            </A>
            
            <A href="/settings" className="clickable-link active" link="" aria-current="page">
                <p id="link-settings" className="links-texts">Settings</p>
            </A>


        </div>
    )

}

export default Topbar;