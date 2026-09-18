; Custom uninstaller page: "Também excluir dados e documentos do Formatador Comissão".
;
; Preserving user data is the default - this page's checkbox starts UNCHECKED, and a silent
; uninstall (/S) never shows any custom page at all, so a scripted/silent uninstall always
; preserves data too. All actual path-safety logic (hard blocklist against Documents/Desktop/
; Downloads/user profile/drive roots, requiring a report-root ownership manifest, never touching
; anything not explicitly app-managed) lives in the app's own compiled TypeScript
; (src/main/app/uninstallPlan.ts), never duplicated here - this script only drives the UI and
; invokes the app's own executable in its headless "--uninstall-check-paths" /
; "--uninstall-delete-data" CLI modes, while the app's files are still on disk (this page runs
; BEFORE MUI_UNPAGE_INSTFILES removes them).

!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "LogicLib.nsh"

; This whole file is !include'd (and its top-level Functions parsed) before common.nsh defines
; ${APP_EXECUTABLE_FILENAME} - so that define isn't usable here yet. Reconstructed locally from
; ${PRODUCT_FILENAME}, which (unlike APP_EXECUTABLE_FILENAME) is passed on the makensis command
; line and so is always already available, no matter how early this file is processed.
!define un.AppExe "${PRODUCT_FILENAME}.exe"

; This file is !include'd during BOTH the installer-build pass and the separate
; uninstaller-build pass. NSIS auto-collects any "un."-prefixed Function/Var into the
; uninstaller stub - during the installer pass that would be dead, unconsumed uninstaller
; code (no WriteUninstaller call to embed it), which NSIS treats as a build-breaking warning.
; Guarding the whole page implementation behind BUILD_UNINSTALLER keeps it out of that pass
; entirely.
!ifdef BUILD_UNINSTALLER

Var un.DataCheckbox
Var un.DataPathsField

!macro customUnWelcomePage
  UninstPage custom un.DataCleanupPageCreate un.DataCleanupPageLeave
!macroend

Function un.DataCleanupPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0u 100% 32u "Por padrão, a desinstalação remove somente o programa. Seus dados e documentos (relatórios gerados, histórico e configurações) são preservados, para o caso de você reinstalar mais tarde."
  Pop $1

  ${NSD_CreateCheckbox} 0 38u 100% 10u "Também excluir dados e documentos do Formatador Comissão"
  Pop $un.DataCheckbox
  ${NSD_OnClick} $un.DataCheckbox un.OnDataCheckboxToggled

  ${NSD_CreateLabel} 0 52u 100% 10u "Se marcado, os caminhos a seguir serão removidos permanentemente ao continuar:"
  Pop $2

  ${NSD_CreateText} 0 64u 100% 90u ""
  Pop $un.DataPathsField
  ${NSD_AddStyle} $un.DataPathsField ${ES_MULTILINE}|${ES_AUTOVSCROLL}
  ${NSD_Edit_SetReadOnly} $un.DataPathsField 1

  nsDialogs::Show
FunctionEnd

Function un.OnDataCheckboxToggled
  ${NSD_GetState} $un.DataCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    Call un.PopulateDataPaths
  ${Else}
    ${NSD_SetText} $un.DataPathsField ""
  ${EndIf}
FunctionEnd

; Runs the app's own executable headlessly (--uninstall-check-paths) so the exact same,
; already-tested TypeScript safety logic decides what is eligible - this script never
; re-implements or guesses at path resolution itself.
Function un.PopulateDataPaths
  GetTempFileName $R0
  Delete "$R0"
  ExecWait '"$INSTDIR\${un.AppExe}" --uninstall-check-paths "--uninstall-out=$R0"' $R1

  StrCpy $R3 ""
  ${If} ${FileExists} "$R0"
    FileOpen $R2 "$R0" r
    ${DoUntil} ${Errors}
      FileReadUTF16LE $R2 $R4
      ${IfNot} ${Errors}
        StrCpy $R3 "$R3$R4"
      ${EndIf}
    ${Loop}
    FileClose $R2
    Delete "$R0"
  ${EndIf}

  ${If} $R3 == ""
    StrCpy $R3 "Nenhum dado gerenciado pelo Formatador Comissão foi encontrado nesta instalação."
  ${EndIf}
  ${NSD_SetText} $un.DataPathsField "$R3"
FunctionEnd

Function un.DataCleanupPageLeave
  ${NSD_GetState} $un.DataCheckbox $0
  ${IfNot} $0 == ${BST_CHECKED}
    Return
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
    "Tem certeza? Isso removerá PERMANENTEMENTE os dados e documentos do Formatador Comissão listados nesta página, incluindo relatórios gerados e histórico.$\r$\n$\r$\nEsta ação não pode ser desfeita. Deseja continuar?" \
    IDYES +2
  Abort

  GetTempFileName $R0
  Delete "$R0"
  ExecWait '"$INSTDIR\${un.AppExe}" --uninstall-delete-data "--uninstall-out=$R0"' $R1

  ; First line is exactly "OK" or "ERROR", optionally followed by CRLF (there is no trailing
  ; newline at all when the app wrote a single-line file, e.g. nothing was eligible to delete) -
  ; a prefix check on the first 2 characters covers both cases.
  StrCpy $R5 "0"
  ${If} ${FileExists} "$R0"
    FileOpen $R2 "$R0" r
    FileReadUTF16LE $R2 $R4
    StrCpy $R6 $R4 2
    ${IfNot} ${Errors}
    ${AndIf} $R6 == "OK"
      StrCpy $R5 "1"
    ${EndIf}
    FileClose $R2
    Delete "$R0"
  ${EndIf}

  ${IfNot} $R5 == "1"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Não foi possível confirmar a remoção completa dos dados. O programa será removido normalmente; verifique manualmente a pasta de relatórios, se necessário."
  ${EndIf}
FunctionEnd

!endif ; BUILD_UNINSTALLER
