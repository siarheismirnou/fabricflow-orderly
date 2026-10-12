import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/DirectoryPage";
import { hasAny, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Поставщики — Ткани" }, { name: "description", content: "Справочник поставщиков тканей" }, { property: "og:title", content: "Поставщики — Ткани" }, { property: "og:description", content: "Справочник поставщиков тканей" }] }),
  component: () => {
    const { data: me } = useMe();
    return (
      <DirectoryPage
        table="suppliers"
        title="Поставщики"
        subtitle="Фабрики и дистрибьюторы тканей"
        canEdit={hasAny(me?.roles, ["sales_manager", "warehouse"])}
        fields={[
          { key: "name", label: "Название", required: true },
          { key: "contact_person", label: "Контактное лицо" },
          { key: "phone", label: "Телефон" },
          { key: "email", label: "Email" },
          { key: "country", label: "Страна" },
        ]}
      />
    );
  },
});
