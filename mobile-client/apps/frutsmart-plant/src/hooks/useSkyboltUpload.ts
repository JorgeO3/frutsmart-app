import { useSkyboltUploadContext } from "@src/providers/SkyboltUploadProvider";
import { useSkyboltNativeUpload } from "skybolt";

export function useSkyboltUpload() {
  const session = useSkyboltNativeUpload();
  const jobs = useSkyboltUploadContext();

  // Si quieres evitar colisiones de nombres, puedes agrupar:
  return {
    session,
    jobs,
  };
}
