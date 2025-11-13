import { createSignal, JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import LabelTextInputSettings from "../../Components/UI/LabelTextInput/LabelTextInput";
import { Bittorrent, General } from "../../../../../bindings";
import LabelPathInputSettings from "../../Components/UI/LabelPathInput/LabelPathInput";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function BittorrentPart({
    settings,
    handleSwitchCheckChange,
    handleTextCheckChange,
}: SettingsSectionProps<Bittorrent>): JSX.Element {


    return (
        <PageGroup title="Bittorrent Configuration">
            <LabelCheckboxSettings
                text="Enable DHT"
                typeText="Distributed Hash Table - enables decentralized peer discovery without a tracker"
                action={() => handleSwitchCheckChange?.("bittorrent.enable_dht")}
                checked={settings()["enable-dht"]}
            />
            <LabelNumericalInput
                text="Listening Port"
                typeText="Port number used by the Bittorrent client to accept incoming connections"
                value={settings()["listen-port"]}
                onInput={(value) => handleTextCheckChange?.("bittorrent.listen_port", value)}
            />
            <LabelNumericalInput
                text="Max Peers"
                typeText="Maximum number of peers to connect to per torrent"
                value={settings()["max-peers"]}
                onInput={(value) => handleTextCheckChange?.("bittorrent.max_peers", value)}
            />
            <LabelNumericalInput
                text="Seed Ratio"
                typeText="Ratio of uploaded data to downloaded data before stopping seeding"
                value={settings()["seed-ratio"] ?? 0}
                onInput={(value) =>
                    handleTextCheckChange?.("bittorrent.seed_ratio", value === 0 ? null : value)
                }
                zeroIsInfinite
            />
            <LabelNumericalInput
                text="Seed Time"
                typeText="Time in minutes to keep seeding after download completes"
                value={settings()["seed-time"] ?? 0}
                onInput={(value) =>
                    handleTextCheckChange?.("bittorrent.seed_time", value === 0 ? null : value)
                }
                zeroIsInfinite
                valueType="Min"
            />

        </PageGroup>

    );
}