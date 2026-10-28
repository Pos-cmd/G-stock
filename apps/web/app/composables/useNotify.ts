export const useNotify = () => {
  const toast = useToast();
  const icons = useIcons();

  const success = (title: string, description?: string) => {
    toast.add({
      color: "success",
      description,
      icon: icons.success,
      title,
    });
  };

  const error = (title: string, cause: unknown) => {
    toast.add({
      color: "error",
      description: cause instanceof Error ? cause.message : "Veuillez réessayer.",
      icon: icons.error,
      title,
    });
  };

  return { error, success };
};
