// En français, seule la virgule sépare les décimales : les champs numériques refusaient le point
// du pavé numérique. On le remplace par une virgule avant que le champ ne valide la frappe.
export default defineNuxtPlugin(() => {
  document.addEventListener(
    "beforeinput",
    (event) => {
      const { target } = event;
      const isNumberField =
        target instanceof HTMLInputElement && target.getAttribute("role") === "spinbutton";
      if (!isNumberField || event.data !== "." || target.value.includes(",")) {
        return;
      }
      event.preventDefault();
      target.setRangeText(",", target.selectionStart ?? 0, target.selectionEnd ?? 0, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { capture: true },
  );
});
