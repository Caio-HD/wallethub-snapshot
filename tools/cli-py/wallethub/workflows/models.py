"""Modelos de dados para workflows"""

from dataclasses import dataclass
from typing import Callable, Optional, Sequence
from wallethub.context import MenuContext


@dataclass(frozen=True)
class WorkflowStep:
    """Step individual de um workflow"""
    
    id: str
    label: str
    run: Callable[[MenuContext], bool]
    success_hint: Optional[str] = None
    diagnostic: Optional[Callable[[MenuContext], None]] = None
    continue_on_fail: bool = False


@dataclass(frozen=True)
class Workflow:
    """Workflow completo com múltiplos steps"""
    
    id: str
    title: str
    description: str
    steps: Sequence[WorkflowStep]
    domain: str
    icon: str = "🛠️"


def run_workflow(ctx: MenuContext, workflow: Workflow) -> bool:
    """
    Executa um workflow completo com tratamento de erros.
    
    Args:
        ctx: Contexto da CLI
        workflow: Workflow a executar
    
    Returns:
        True se workflow completou com sucesso, False caso contrário
    """
    print(f"\n🚀 Iniciando workflow: {workflow.title}\n{workflow.description}\n")
    
    for position, step in enumerate(workflow.steps, start=1):
        print(f"→ [{position}/{len(workflow.steps)}] {step.label}")
        
        try:
            ok = step.run(ctx)
            
            if ok:
                print("   ✓ Concluído")
                if step.success_hint:
                    print(f"   {step.success_hint}")
                if step.diagnostic:
                    try:
                        step.diagnostic(ctx)
                    except Exception as diag_error:
                        print(f"⚠️  Diagnóstico falhou: {diag_error}")
            else:
                print("   ✗ Falhou")
                if not step.continue_on_fail:
                    print("\n⛔ Workflow interrompido devido a erro.")
                    return False
                    
        except Exception as e:
            print(f"   ✗ Erro: {e}")
            if not step.continue_on_fail:
                print("\n⛔ Workflow interrompido devido a erro.")
                return False
    
    print(f"\n✅ Workflow '{workflow.title}' concluído com sucesso!")
    return True




