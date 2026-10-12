import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/DirectoryPage";
import { hasAny, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Клиенты — Ткани" }, { name: "description", content: "Справочник клиентов" }, { property: "og:title", content: "Клиенты — Ткани" }, { property: "og:description", content: "Справочник клиентов" }] }),
  component: () => {
    const { data: me } = useMe();
    return (
      <DirectoryPage
        table="clients"
        title="Клиенты"
        subtitle="Справочник организаций и частных клиентов"
        canEdit={hasAny(me?.roles, ["sales_manager"])}
        fields={[
          { key: "name", label: "Наименование", required: true },
          { key: "inn", label: "ИНН" },
          { key: "phone", label: "Телефон" },
          { key: "email", label: "Email" },
          { key: "address", label: "Адрес" },
        ]}
      />
    );
  },
});
