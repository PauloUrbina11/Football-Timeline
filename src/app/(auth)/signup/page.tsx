import { Container } from "@/components/ui/container";
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignupPage() {
  return (
    <Container className="flex flex-1 items-center justify-center py-12">
      <SignupForm />
    </Container>
  );
}
