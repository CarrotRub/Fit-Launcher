import { JSX } from "solid-js";
import { SettingsSectionProps } from "../../../../../types/settings/types";
import LabelCheckboxSettings from "../../Components/UI/LabelCheckbox/LabelCheckbox";
import PageGroup from "../../Components/PageGroup";
import { Bittorrent } from "../../../../../bindings";
import LabelNumericalInput from "../../Components/UI/LabelNumericalInput/LabelNumericalInput";

export default function BittorrentPart(props: SettingsSectionProps<Bittorrent>): JSX.Element {
    return (
        <PageGroup title="Bittorrent Configuration">
            <LabelCheckboxSettings
                text="Enable DHT"
                typeText="Distributed Hash Table - enables decentralized peer discovery without a tracker"
                action={() => props.handleSwitchCheckChange?.("bittorrent.enable-dht")}
                checked={props.settings()["enable-dht"]}
            />
            <LabelNumericalInput
                text="Listening Port"
                typeText="Port number used by the Bittorrent client to accept incoming connections"
                value={props.settings()["listen-port"]}
                onInput={(value) => props.handleTextCheckChange?.("bittorrent.listen-port", value)}
                isDirty={props.isDirty?.("bittorrent.listen-port")}
                savePulse={props.savePulse?.("bittorrent.listen-port")}
            />
            <LabelNumericalInput
                text="Max Peers"
                typeText="Maximum number of peers to connect to per torrent"
                value={props.settings()["max-peers"]}
                onInput={(value) => props.handleTextCheckChange?.("bittorrent.max-peers", value)}
                isDirty={props.isDirty?.("bittorrent.max-peers")}
                savePulse={props.savePulse?.("bittorrent.max-peers")}
            />
            <LabelNumericalInput
                text="Seed Ratio"
                typeText="Ratio of uploaded data to downloaded data before stopping seeding (0 = unlimited)"
                value={props.settings()["seed-ratio"] ?? 0}
                onInput={(value) =>
                    props.handleTextCheckChange?.("bittorrent.seed-ratio", value === 0 ? null : value)
                }
                step={0.1}
                isDirty={props.isDirty?.("bittorrent.seed-ratio")}
                savePulse={props.savePulse?.("bittorrent.seed-ratio")}
            />
            <LabelNumericalInput
                text="Seed Time"
                typeText="Time in minutes to keep seeding after download completes (0 = unlimited)"
                value={props.settings()["seed-time"] ?? 0}
                onInput={(value) =>
                    props.handleTextCheckChange?.("bittorrent.seed-time", value === 0 ? null : value)
                }
                valueType="Min"
                isDirty={props.isDirty?.("bittorrent.seed-time")}
                savePulse={props.savePulse?.("bittorrent.seed-time")}
            />
        </PageGroup>
    );
}