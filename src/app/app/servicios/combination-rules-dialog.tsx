"use client";

import { useState } from "react";
import { Trash2, Plus, Percent, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useCombinationRules, useCreateCombinationRule, useDeleteCombinationRule } from "@/lib/api/catalog";
import { formatMoney, formatDuration, titleCaseName } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";
import type { CombinationRuleType } from "@/lib/api/generated/model/combinationRuleType";
import type { DiscountType } from "@/lib/api/generated/model/discountType";

const RULE_TYPE_LABELS: Record<CombinationRuleType, string> = {
  enables: "Habilita",
  free_with: "Gratis con",
  discount: "Descuento en",
  excludes: "Excluye",
};

const RULE_TYPE_BADGE: Record<CombinationRuleType, string> = {
  enables: "bg-accent/10 text-accent",
  free_with: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  discount: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  excludes: "bg-destructive/10 text-destructive",
};

export function CombinationRulesDialog({
  comercioId,
  service,
  allServices,
  onClose,
}: {
  comercioId: string;
  service: Service;
  allServices: Service[];
  onClose: () => void;
}) {
  const { data: allRules, isLoading, isError } = useCombinationRules(comercioId);
  const createRule = useCreateCombinationRule(comercioId);
  const deleteRule = useDeleteCombinationRule(comercioId);

  // Reglas donde este servicio es el disparador
  const rules = (allRules ?? []).filter((r) => r.sourceServiceId === service.id);

  // Servicios disponibles como destino (excluye el servicio actual)
  const targetOptions = allServices.filter((s) => s.id !== service.id);

  // Estado del formulario de nueva regla
  const [targetId, setTargetId] = useState("");
  const [ruleType, setRuleType] = useState<CombinationRuleType>("enables");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountAmount, setDiscountAmount] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const needsDiscount = ruleType === "discount";
  const discountAmountNum = Number(discountAmount);
  const discountOk =
    !needsDiscount ||
    (discountAmount.trim() !== "" &&
      discountAmountNum > 0 &&
      (discountType !== "percentage" || discountAmountNum <= 100));

  const canCreate = targetId !== "" && discountOk && !createRule.isPending;

  function handleCreate() {
    setCreateError(null);
    const discountAmountCents = needsDiscount ? Math.round(discountAmountNum * 100) : undefined;

    createRule.mutate(
      {
        sourceServiceId: service.id,
        targetServiceId: targetId,
        ruleType,
        discountAmountCents,
        discountType: needsDiscount ? discountType : undefined,
      },
      {
        onSuccess: () => {
          setTargetId("");
          setDiscountAmount("");
          setRuleType("enables");
        },
        onError: (err) => {
          setCreateError(getApiErrorMessage(err, "No se pudo crear la regla. Revisá que no exista una igual."));
        },
      },
    );
  }

  function handleDelete(ruleId: string) {
    deleteRule.mutate(ruleId);
  }

  function discountLabel(amountCents: number | null | undefined, type: DiscountType | null | undefined): string {
    if (amountCents == null || type == null) return "";
    if (type === "percentage") return `${amountCents / 100}% off`;
    return `${formatMoney(amountCents)} off`;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Reglas de combinación — {titleCaseName(service.name)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          {/* Reglas actuales */}
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Cuando el cliente elige <strong>{titleCaseName(service.name)}</strong>, se aplican estas reglas:
            </p>

            {isLoading && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
            {isError && (
              <p className="text-sm text-destructive">No se pudieron cargar las reglas.</p>
            )}
            {!isLoading && rules.length === 0 && (
              <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
                Todavía no hay reglas para este servicio.
              </p>
            )}
            {rules.length > 0 && (
              <ul className="space-y-2">
                {rules.map((rule) => {
                  const target = allServices.find((s) => s.id === rule.targetServiceId);
                  const targetName = titleCaseName(target?.name ?? rule.targetServiceId);
                  return (
                    <li
                      key={rule.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          RULE_TYPE_BADGE[rule.ruleType],
                        )}
                      >
                        {RULE_TYPE_LABELS[rule.ruleType]}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{targetName}</span>
                      {rule.ruleType === "discount" && (
                        <Badge variant="muted">
                          {discountLabel(rule.discountAmountCents, rule.discountType)}
                        </Badge>
                      )}
                      {rule.ruleType === "free_with" && (
                        <Badge variant="muted">Gratis</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar regla"
                        disabled={deleteRule.isPending}
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Formulario de nueva regla */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium">Agregar regla</p>

            {targetOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Necesitás al menos dos servicios para crear reglas de combinación.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Tipo de regla</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["enables", "free_with", "discount", "excludes"] as CombinationRuleType[]).map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRuleType(type)}
                          className={cn(
                            "rounded-lg border p-2.5 text-left text-sm transition-colors",
                            ruleType === type
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border hover:border-accent/50",
                          )}
                        >
                          <span className="font-medium">{RULE_TYPE_LABELS[type]}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {type === "enables" && "Habilita otro servicio como extra"}
                            {type === "free_with" && "El extra viene incluido gratis"}
                            {type === "discount" && "Aplica descuento en otro servicio"}
                            {type === "excludes" && "Impide elegir otro servicio"}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="cr-target">Servicio destino</Label>
                  <select
                    id="cr-target"
                    aria-label="Servicio destino"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Elegí un servicio —</option>
                    {targetOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {titleCaseName(s.name)} · {formatDuration(s.durationMinutes)} · {formatMoney(s.priceCents)}
                      </option>
                    ))}
                  </select>
                </div>

                {needsDiscount && (
                  <div className="space-y-3">
                    <div>
                      <Label>Tipo de descuento</Label>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDiscountType("percentage")}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition-colors",
                            discountType === "percentage"
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border hover:border-accent/50",
                          )}
                        >
                          <Percent className="size-3.5" /> Porcentaje
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("fixed")}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition-colors",
                            discountType === "fixed"
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border hover:border-accent/50",
                          )}
                        >
                          <DollarSign className="size-3.5" /> Monto fijo
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="cr-amount">
                        {discountType === "percentage" ? "Porcentaje (%)" : "Monto a descontar ($)"}
                      </Label>
                      <Input
                        id="cr-amount"
                        type="number"
                        min={1}
                        max={discountType === "percentage" ? 100 : undefined}
                        step={discountType === "percentage" ? 1 : 100}
                        className="mt-1.5"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        placeholder={discountType === "percentage" ? "Ej: 20" : "Ej: 1000"}
                      />
                      {discountType === "percentage" && discountAmountNum > 100 && (
                        <p className="mt-1 text-xs text-destructive">Máximo 100%.</p>
                      )}
                    </div>
                  </div>
                )}

                {createError && <p className="text-sm text-destructive">{createError}</p>}

                <Button
                  className="w-full"
                  size="sm"
                  disabled={!canCreate}
                  onClick={handleCreate}
                >
                  {createRule.isPending ? <Spinner /> : <Plus className="size-4" />}
                  Agregar regla
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
