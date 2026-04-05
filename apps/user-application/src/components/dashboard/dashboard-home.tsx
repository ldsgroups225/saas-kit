import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { useState } from "react";
import {
  createMissionUpdate,
  flushPendingMissionUpdates,
  getPendingMissionUpdates,
  queueMissionUpdate,
} from "@/components/dashboard/mission-sync";

type MissionStatus = "scheduled" | "in_transit" | "delivered";

type Mission = {
  id: string;
  code: string;
  customer: string;
  destination: string;
  status: MissionStatus;
};

const initialMissions: Array<Mission> = [
  {
    id: "mission-001",
    code: "M-1001",
    customer: "Sotra Bulk Depot",
    destination: "Yopougon Hub",
    status: "scheduled",
  },
  {
    id: "mission-002",
    code: "M-1002",
    customer: "Port Authority",
    destination: "Bouake Relay Yard",
    status: "in_transit",
  },
];

export function DashboardHome() {
  const defaultMission = initialMissions[0];
  const [missions, setMissions] = useState<Array<Mission>>(initialMissions);
  const [selectedMissionId, setSelectedMissionId] = useState(defaultMission?.id ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [syncSummary, setSyncSummary] = useState("");
  const [pendingCount, setPendingCount] = useState(getPendingMissionUpdates().length);

  const selectedMission =
    missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null;

  if (!selectedMission) {
    return null;
  }

  const queueOrSendStatus = (status: MissionStatus) => {
    const update = createMissionUpdate(selectedMission.id, "status", { status });

    if (!navigator.onLine) {
      queueMissionUpdate(update);
      setPendingCount(getPendingMissionUpdates().length);
      setSyncSummary("Offline mode: update queued for sync.");
      return;
    }

    setMissions((current) =>
      current.map((mission) =>
        mission.id === selectedMission.id ? { ...mission, status } : mission,
      ),
    );
    setSyncSummary("Mission status saved.");
  };

  const handleSaveProof = () => {
    if (!recipientName.trim()) {
      setSyncSummary("Recipient name is required before saving proof.");
      return;
    }

    const proofUpdate = createMissionUpdate(selectedMission.id, "proof", {
      recipientName: recipientName.trim(),
      deliveryNote: deliveryNote.trim(),
    });

    if (!navigator.onLine) {
      queueMissionUpdate(proofUpdate);
      setPendingCount(getPendingMissionUpdates().length);
      setSyncSummary("Offline mode: proof queued for sync.");
      return;
    }

    setMissions((current) =>
      current.map((mission) =>
        mission.id === selectedMission.id
          ? { ...mission, status: "delivered" }
          : mission,
      ),
    );
    setSyncSummary("Proof of delivery saved.");
  };

  const handleSyncNow = async () => {
    if (!navigator.onLine) {
      setSyncSummary("Cannot sync while offline.");
      return;
    }

    const result = await flushPendingMissionUpdates(async () => Promise.resolve());
    setPendingCount(getPendingMissionUpdates().length);
    setSyncSummary(`Sync complete: ${result.sent} sent, ${result.failed} failed.`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>
            <h2>Field Missions</h2>
          </CardTitle>
          <CardDescription>
            Mission list + execution updates with offline-safe queueing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="font-semibold text-foreground">{mission.code}</p>
              <p className="mt-1 text-sm text-muted-foreground">{mission.customer}</p>
              <p className="text-sm text-muted-foreground">{mission.destination}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                {mission.status.replace("_", " ")}
              </p>
              <Button
                variant={mission.id === selectedMission.id ? "default" : "outline"}
                className="mt-3"
                onClick={() => setSelectedMissionId(mission.id)}
              >
                Select mission
              </Button>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Pending sync queue: {pendingCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Proof of Delivery</h2>
          </CardTitle>
          <CardDescription>
            Capture recipient confirmation baseline for selected mission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Recipient name</Label>
            <Input
              id="recipient-name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Driver confirms receiver full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-note">Delivery note</Label>
            <Textarea
              id="delivery-note"
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              placeholder="Gate code, delay reason, or loading remark"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => queueOrSendStatus("in_transit")}>
              Mark In Transit
            </Button>
            <Button variant="secondary" onClick={handleSaveProof}>
              Save Proof
            </Button>
            <Button variant="outline" onClick={handleSyncNow}>
              Sync now
            </Button>
          </div>
          {syncSummary ? (
            <p className="text-sm text-muted-foreground">{syncSummary}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
