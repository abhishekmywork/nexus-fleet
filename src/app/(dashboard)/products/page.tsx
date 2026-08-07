import { PackageSearch, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Products" };

const PLACEHOLDER_CARDS = [
  { title: "Total Products", value: "1,284" },
  { title: "Out of Stock", value: "23" },
  { title: "Low Stock", value: "57" },
  { title: "Draft", value: "96" },
];

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog, inventory, and listings."
        actions={
          <Button>
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Add Product
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLACEHOLDER_CARDS.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex min-h-[300px] flex-col items-center justify-center border-dashed p-10 text-center shadow-sm">
        <PackageSearch className="size-10 text-muted-foreground/50" aria-hidden="true" />
        <CardHeader>
          <CardTitle>Product catalog coming soon</CardTitle>
          <CardDescription>
            This placeholder page will host the full product management
            experience — reuse the CRUD table pattern from the Users page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
