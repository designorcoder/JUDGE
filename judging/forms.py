from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm
from judging.models import SchoolClass, Group, GroupMember, Evaluation

User = get_user_model()

class CustomAuthenticationForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({
            'placeholder': 'Foydalanuvchi nomingizni kiriting',
            'class': 'w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm'
        })
        self.fields['username'].label = "Foydalanuvchi nomi"
        self.fields['username'].error_messages = {
            'required': "Bu maydon to'ldirilishi shart"
        }
        self.fields['password'].widget.attrs.update({
            'placeholder': '••••••••',
            'class': 'w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm'
        })
        self.fields['password'].label = "Parol"
        self.fields['password'].error_messages = {
            'required': "Bu maydon to'ldirilishi shart"
        }

    error_messages = {
        'invalid_login': (
            "Foydalanuvchi nomi yoki parol noto'g'ri."
        ),
        'inactive': "Ushbu hisob faol emas.",
    }


class ClassForm(forms.ModelForm):
    class Meta:
        model = SchoolClass
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: 9-A, 10-B'
            })
        }
        error_messages = {
            'name': {
                'required': "Bu maydon to'ldirilishi shart",
                'unique': "Bunday nomli sinf allaqachon mavjud",
            }
        }


class GroupForm(forms.ModelForm):
    members_csv = forms.CharField(
        required=False,
        label="Talabalar / A'zolar",
        widget=forms.Textarea(attrs={
            'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-20',
            'placeholder': 'Talabalar ismlarini vergul bilan ajratib kiriting (masalan: Rustamov Ali, Karimov Valisher, Aliyeva Madina)'
        })
    )

    class Meta:
        model = Group
        fields = ['name', 'project_name', 'school_class', 'judges']
        labels = {
            'name': "Guruh nomi",
            'project_name': "Loyiha nomi",
            'school_class': "Sinf",
            'judges': "Biriktirilgan hakamlar"
        }
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: Alfa jamoasi, Gidra guruhi'
            }),
            'project_name': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: Aqlli e-tijorat platformasi'
            }),
            'school_class': forms.Select(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all'
            }),
            'judges': forms.SelectMultiple(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-32',
                'help_text': "Ko'p hakamlarni tanlash uchun Ctrl (yoki Cmd) tugmasini bosib turing."
            })
        }
        error_messages = {
            'name': {
                'required': "Bu maydon to'ldirilishi shart"
            },
            'project_name': {
                'required': "Bu maydon to'ldirilishi shart"
            },
            'school_class': {
                'required': "Bu maydon to'ldirilishi shart"
            },
            'judges': {
                'required': "Bu maydon to'ldirilishi shart"
            }
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Limit judges queryset to only active judges
        self.fields['judges'].queryset = User.objects.filter(role='JUDGE')
        
        # Populate members CSV if editing an existing instance
        if self.instance and self.instance.pk:
            members = self.instance.members.all()
            self.fields['members_csv'].initial = ", ".join(m.name for m in members)

    def save(self, commit=True):
        group = super().save(commit=commit)
        if commit:
            # Parse and save members
            csv_data = self.cleaned_data.get('members_csv', '')
            # Clear existing members
            group.members.all().delete()
            # Split and create new members
            for name in csv_data.split(','):
                name = name.strip()
                if name:
                    GroupMember.objects.create(name=name, group=group)
        return group


class EvaluationForm(forms.ModelForm):
    class Meta:
        model = Evaluation
        fields = [
            'score_functionality',
            'score_architecture',
            'score_performance',
            'score_security',
            'score_ui_ux',
            'comment'
        ]
        labels = {
            'score_functionality': "Funksionallik",
            'score_architecture': "Kod sifati va arxitektura",
            'score_performance': "Samaradorlik va tezlik",
            'score_security': "Xavfsizlik",
            'score_ui_ux': "UI/UX",
            'comment': "Izoh"
        }
        widgets = {
            'score_functionality': forms.NumberInput(attrs={'type': 'range', 'min': '1', 'max': '10', 'class': 'w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none cursor-pointer h-2'}),
            'score_architecture': forms.NumberInput(attrs={'type': 'range', 'min': '1', 'max': '10', 'class': 'w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none cursor-pointer h-2'}),
            'score_performance': forms.NumberInput(attrs={'type': 'range', 'min': '1', 'max': '10', 'class': 'w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none cursor-pointer h-2'}),
            'score_security': forms.NumberInput(attrs={'type': 'range', 'min': '1', 'max': '10', 'class': 'w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none cursor-pointer h-2'}),
            'score_ui_ux': forms.NumberInput(attrs={'type': 'range', 'min': '1', 'max': '10', 'class': 'w-full accent-emerald-500 bg-slate-700 rounded-lg appearance-none cursor-pointer h-2'}),
            'comment': forms.Textarea(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-28',
                'placeholder': 'Kod, foydalanuvchi interfeysi va tajribasi, ishlash tezligi va tizim tuzilishi haqida fikringizni kiriting...'
            })
        }
        error_messages = {
            'score_functionality': {
                'required': "Bu maydon to'ldirilishi shart",
                'min_value': "Ball 1 dan kam bo'lmasligi kerak",
                'max_value': "Ball 10 dan oshmasligi kerak",
            },
            'score_architecture': {
                'required': "Bu maydon to'ldirilishi shart",
                'min_value': "Ball 1 dan kam bo'lmasligi kerak",
                'max_value': "Ball 10 dan oshmasligi kerak",
            },
            'score_performance': {
                'required': "Bu maydon to'ldirilishi shart",
                'min_value': "Ball 1 dan kam bo'lmasligi kerak",
                'max_value': "Ball 10 dan oshmasligi kerak",
            },
            'score_security': {
                'required': "Bu maydon to'ldirilishi shart",
                'min_value': "Ball 1 dan kam bo'lmasligi kerak",
                'max_value': "Ball 10 dan oshmasligi kerak",
            },
            'score_ui_ux': {
                'required': "Bu maydon to'ldirilishi shart",
                'min_value': "Ball 1 dan kam bo'lmasligi kerak",
                'max_value': "Ball 10 dan oshmasligi kerak",
            },
            'comment': {
                'required': "Bu maydon to'ldirilishi shart"
            }
        }


class JudgeCreationForm(forms.ModelForm):
    password = forms.CharField(
        label="Parol",
        widget=forms.PasswordInput(attrs={
            'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
            'placeholder': '••••••••'
        }),
        error_messages={'required': "Bu maydon to'ldirilishi shart"}
    )

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name']
        labels = {
            'username': "Foydalanuvchi nomi",
            'first_name': "Ism",
            'last_name': "Familiya",
        }
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: judge_rustam'
            }),
            'first_name': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: Rustam'
            }),
            'last_name': forms.TextInput(attrs={
                'class': 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all',
                'placeholder': 'Masalan: Karimov'
            }),
        }
        error_messages = {
            'username': {
                'required': "Bu maydon to'ldirilishi shart",
                'unique': "Bunday foydalanuvchi nomi allaqachon mavjud",
            }
        }

    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = 'JUDGE'
        user.set_password(self.cleaned_data['password'])
        if commit:
            user.save()
        return user
