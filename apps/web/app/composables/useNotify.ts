export const useNotify = () => {
  const toast = useToast();

  const success = (title: string, description?: string) => {
    toast.add({
      color: "success",
      description,
      icon: "i-lucide-circle-check",
      title,
    });
  };

  const error = (title: string, cause: unknown) => {
    toast.add({
      color: "error",
      description: cause instanceof Error ? cause.message : "Veuillez réessayer.",
      icon: "i-lucide-circle-alert",
      title,
    });
  };

  return { error, success };
};
