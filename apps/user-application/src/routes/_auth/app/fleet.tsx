import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { fleetAssetsSeed } from "@/core/contracts/nafa-operations";

export const Route = createFileRoute("/_auth/app/fleet")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fleet Readiness</CardTitle>
        <CardDescription>
          Vehicles and drivers available for assignment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {fleetAssetsSeed.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{asset.label}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {asset.kind}
              </p>
            </div>
            <div className="text-right">
              <Badge variant={asset.status === "active" ? "default" : "secondary"}>
                {asset.status}
              </Badge>
              {asset.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{asset.reason}</p>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
