import { Component, computed, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { map } from 'rxjs';
import {
  AccessDecisionDraft,
  AccessOutcome,
  AccessRequest,
} from '../../access-requests/access-request';
import { formatPeriod } from '../../access-requests/access-request-format';
import { firstName } from '../../access-requests/access-request-queries';
import { Icon } from '../../shared/icon/icon';

export const CHOOSE_OUTCOME_ERROR = 'Kies eerst of je de aanvraag goedkeurt of afwijst.';
export const COMMENT_REQUIRED_ERROR =
  'Geef een toelichting bij een afwijzing. De aanvrager leest deze in de e-mail.';

interface DecisionFormValue {
  readonly outcome: AccessOutcome | '';
  readonly comment: string;
}

/** What is still missing before a decision can be saved. A rejection needs an explanation. */
export function decisionProblem(value: DecisionFormValue): 'outcome' | 'comment' | null {
  if (!value.outcome) return 'outcome';
  if (value.outcome === 'rejected' && !value.comment.trim()) return 'comment';
  return null;
}

function decisionRules(group: AbstractControl): ValidationErrors | null {
  const problem = decisionProblem(group.getRawValue() as DecisionFormValue);
  return problem ? { [problem]: true } : null;
}

/** Approve or reject one request, and optionally the rest of the person's open requests. */
@Component({
  selector: 'app-access-decision-form',
  imports: [ReactiveFormsModule, Icon],
  styleUrl: './access-decision-form.scss',
  template: `
    <form class="decision" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <fieldset class="decision__outcome">
        <legend>Besluit</legend>
        <div class="decision__choices">
          <button
            type="button"
            class="choice choice--approved"
            [attr.aria-pressed]="outcome() === 'approved'"
            (click)="choose('approved')"
          >
            <app-icon name="check" [size]="20" [strokeWidth]="2.6" />
            Goedkeuren
          </button>
          <button
            type="button"
            class="choice choice--rejected"
            [attr.aria-pressed]="outcome() === 'rejected'"
            (click)="choose('rejected')"
          >
            <app-icon name="close" [size]="20" [strokeWidth]="2.6" />
            Afwijzen
          </button>
        </div>
      </fieldset>

      <div class="field">
        <label for="decision-comment">
          Toelichting voor de aanvrager
          @if (commentTag()) {
            <span class="optional">{{ commentTag() }}</span>
          }
        </label>
        <p id="decision-comment-hint" class="hint">{{ commentHint() }}</p>
        <textarea
          #comment
          id="decision-comment"
          rows="4"
          formControlName="comment"
          [attr.aria-invalid]="shownProblem() === 'comment'"
          [attr.aria-describedby]="
            shownProblem() === 'comment'
              ? 'decision-comment-hint decision-comment-error'
              : 'decision-comment-hint'
          "
        ></textarea>
        @if (shownProblem() === 'comment') {
          <p id="decision-comment-error" class="error" role="alert">
            <app-icon name="alert-circle" [size]="18" [strokeWidth]="2.2" />
            {{ commentRequiredError }}
          </p>
        }
      </div>

      @if (siblings().length > 0 && !reconsidering()) {
        <div class="series">
          <label class="check">
            <input type="checkbox" formControlName="applyAll" />
            <span>{{ siblingsLabel() }}</span>
          </label>
          <ul>
            @for (sibling of siblings(); track sibling.id) {
              <li>{{ period(sibling) }} · {{ sibling.reason }}</li>
            }
          </ul>
        </div>
      }

      <label class="check check--plain">
        <input type="checkbox" formControlName="notify" />
        <span>Stuur {{ first() }} een e-mail met het besluit en de toelichting</span>
      </label>

      @if (shownProblem() === 'outcome') {
        <p class="error" role="alert">
          <app-icon name="alert-circle" [size]="18" [strokeWidth]="2.2" />
          {{ chooseOutcomeError }}
        </p>
      }

      <div class="decision__actions">
        <button
          type="submit"
          class="btn decision__submit"
          [class.decision__submit--rejected]="outcome() === 'rejected'"
        >
          {{ submitLabel() }}
        </button>
        @if (reconsidering()) {
          <button type="button" class="btn btn--outline" (click)="cancelled.emit()">
            Annuleren
          </button>
        }
      </div>
      <p class="hint">Het besluit, de toelichting en je naam worden bij de aanvraag opgeslagen.</p>
    </form>
  `,
})
export class AccessDecisionForm {
  readonly request = input.required<AccessRequest>();
  /** The person's other open requests, which the decision can be applied to as well. */
  readonly siblings = input<readonly AccessRequest[]>([]);
  /** Changing a decision that was already made. */
  readonly reconsidering = input(false);

  readonly decided = output<AccessDecisionDraft>();
  readonly cancelled = output<void>();

  protected readonly chooseOutcomeError = CHOOSE_OUTCOME_ERROR;
  protected readonly commentRequiredError = COMMENT_REQUIRED_ERROR;
  protected readonly period = (request: AccessRequest) => formatPeriod(request.start, request.end);

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly commentField = viewChild<ElementRef<HTMLTextAreaElement>>('comment');

  protected readonly form = this.fb.group(
    {
      outcome: ['' as AccessOutcome | ''],
      comment: [''],
      applyAll: [false],
      notify: [true],
    },
    { validators: decisionRules },
  );

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  /** Problems only show once the admin tried to save, and go away again as soon as they edit. */
  private readonly attempted = signal(false);

  protected readonly outcome = computed(() => this.value().outcome);
  protected readonly first = computed(() => firstName(this.request()));
  protected readonly shownProblem = computed(() =>
    this.attempted() ? decisionProblem(this.value()) : null,
  );

  protected readonly commentTag = computed(() =>
    this.outcome() === 'rejected' ? '(verplicht)' : this.outcome() === 'approved' ? '(optioneel)' : '',
  );
  protected readonly commentHint = computed(() => {
    switch (this.outcome()) {
      case 'rejected':
        return 'Leg uit waarom, en wat de aanvrager wel kan doen.';
      case 'approved':
        return 'Bijvoorbeeld afspraken over afsluiten of de verwarming.';
      default:
        return 'Verplicht bij afwijzen. De aanvrager leest deze in de e-mail.';
    }
  });

  protected readonly siblingsLabel = computed(() => {
    const count = this.siblings().length;
    const others = count === 1 ? 'andere openstaande aanvraag' : `${count} andere openstaande aanvragen`;
    const verb =
      this.outcome() === 'rejected' ? 'afwijzen' : this.outcome() === 'approved' ? 'goedkeuren' : 'toepassen';
    return `Ook de ${others} van ${this.first()} ${verb}`;
  });

  protected readonly submitLabel = computed(() => {
    const { outcome, applyAll } = this.value();
    if (!outcome) return 'Besluit opslaan';
    const count = 1 + (applyAll ? this.siblings().length : 0);
    const verb = outcome === 'approved' ? 'Goedkeuren' : 'Afwijzen';
    return `${verb}${count > 1 ? ` (${count})` : ''} en opslaan`;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.attempted.set(false));

    // A fresh form for every request, and the earlier decision filled in when it is reconsidered.
    const requestId = computed(() => this.request().id);
    effect(() => {
      requestId();
      const reconsidering = this.reconsidering();
      untracked(() => {
        const { status, comment } = this.request();
        this.form.reset({
          outcome: reconsidering && status !== 'pending' ? status : '',
          comment: reconsidering ? (comment ?? '') : '',
          applyAll: false,
          notify: true,
        });
        this.attempted.set(false);
      });
    });
  }

  protected choose(outcome: AccessOutcome): void {
    this.form.controls.outcome.setValue(outcome);
  }

  protected submit(): void {
    this.attempted.set(true);
    const value = this.form.getRawValue();
    const problem = decisionProblem(value);
    if (problem) {
      if (problem === 'comment') this.commentField()?.nativeElement.focus();
      return;
    }
    this.decided.emit({
      outcome: value.outcome as AccessOutcome,
      comment: value.comment,
      notify: value.notify,
      applyAll: value.applyAll && this.siblings().length > 0,
    });
  }
}
