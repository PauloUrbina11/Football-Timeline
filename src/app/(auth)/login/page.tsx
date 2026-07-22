import { Container } from "@/components/ui/container";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <Container className="flex flex-1 items-center justify-center py-12">
      <LoginForm />
    </Container>
  );
}
