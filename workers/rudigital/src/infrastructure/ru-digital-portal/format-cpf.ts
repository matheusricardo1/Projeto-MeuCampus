/** RU Digital's login form expects the CPF masked as `061.245.552-12`, not raw digits. */
export function formatCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '').padStart(11, '0');
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}
