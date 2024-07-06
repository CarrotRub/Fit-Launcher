import { createSignal, onMount, onCleanup } from "solid-js";

function Mylibrary() {

    onMount(() => {
        let myGamehubDiv = document.querySelector('.gamehub-container')
            
        if(myGamehubDiv !== null) {
            myGamehubDiv.remove()
        }
    })

    return (
        <>
            <div className="mylibrary-container">
                
            </div>


        </>
    )

}

export default Mylibrary;