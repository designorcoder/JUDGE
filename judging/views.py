from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse, reverse_lazy
from django.views.generic import View, TemplateView, RedirectView, ListView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Avg, F, Q, Value, DecimalField, Count, FloatField
from django.db.models.functions import Coalesce
from django.contrib import messages
from django.contrib.auth import get_user_model

from judging.models import SchoolClass, Group, GroupMember, Evaluation
from judging.forms import ClassForm, GroupForm, EvaluationForm, CustomAuthenticationForm, JudgeCreationForm

User = get_user_model()

# ==========================================
# AUTHENTICATION & ACCESS CONTROL
# ==========================================

class CustomLoginView(LoginView):
    template_name = 'login.html'
    form_class = CustomAuthenticationForm
    redirect_authenticated_user = True

    def get_success_url(self):
        user = self.request.user
        if user.is_admin:
            return reverse('admin_dashboard')
        return reverse('judge_dashboard')


class DashboardRedirectView(LoginRequiredMixin, RedirectView):
    def get_redirect_url(self, *args, **kwargs):
        if self.request.user.is_admin:
            return reverse('admin_dashboard')
        return reverse('judge_dashboard')


class AdminRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_authenticated and self.request.user.is_admin


class JudgeRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_authenticated and self.request.user.is_judge

# ==========================================
# ADMIN DASHBOARD & PAGES
# ==========================================

class AdminDashboardView(AdminRequiredMixin, TemplateView):
    template_name = 'admin_dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Aggregates / Stats
        context['total_classes'] = SchoolClass.objects.count()
        context['total_groups'] = Group.objects.count()
        context['total_judges'] = User.objects.filter(role='JUDGE').count()
        context['total_evaluations'] = Evaluation.objects.count()
        
        all_evals = Evaluation.objects.all()
        if all_evals.exists():
            # Sum of averages or average of averages
            total_sum = sum(e.average_score for e in all_evals)
            context['overall_avg_score'] = round(total_sum / len(all_evals), 2)
        else:
            context['overall_avg_score'] = 0.0

        # Recent activities (evaluations)
        context['recent_evaluations'] = Evaluation.objects.select_related('group', 'judge', 'group__school_class').order_by('-created_at')[:5]
        
        # Summary lists
        context['classes'] = SchoolClass.objects.annotate(group_count=Count('groups'))[:5]
        
        # Annotated groups for list
        context['groups'] = Group.objects.annotate(
            evals_count=Count('evaluations'),
            overall_avg=Coalesce(Avg(
                F('evaluations__score_functionality') +
                F('evaluations__score_architecture') +
                F('evaluations__score_performance') +
                F('evaluations__score_security') +
                F('evaluations__score_ui_ux')
            ) / 5.0, Value(0.0, output_field=FloatField()))
        ).select_related('school_class')[:5]

        return context


class AdminClassesView(AdminRequiredMixin, View):
    template_name = 'admin_classes.html'

    def get(self, request):
        classes = SchoolClass.objects.annotate(group_count=Count('groups')).order_by('name')
        form = ClassForm()
        return render(request, self.template_name, {'classes': classes, 'form': form})

    def post(self, request):
        form = ClassForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, f"'{form.cleaned_data['name']}' sinfi muvaffaqiyatli yaratildi!")
            return redirect('admin_classes')
        
        classes = SchoolClass.objects.annotate(group_count=Count('groups')).order_by('name')
        return render(request, self.template_name, {'classes': classes, 'form': form})


class AdminClassesDeleteView(AdminRequiredMixin, View):
    def post(self, request, pk):
        school_class = get_object_or_404(SchoolClass, pk=pk)
        name = school_class.name
        school_class.delete()
        messages.success(request, f"'{name}' sinfi muvaffaqiyatli o'chirildi!")
        return redirect('admin_classes')


class AdminJudgesView(AdminRequiredMixin, View):
    template_name = 'admin_judges.html'

    def get(self, request):
        judges = User.objects.filter(role='JUDGE').annotate(group_count=Count('assigned_groups')).order_by('username')
        form = JudgeCreationForm()
        return render(request, self.template_name, {'judges': judges, 'form': form})

    def post(self, request):
        form = JudgeCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            messages.success(request, f"'{user.username}' hakam sifatida muvaffaqiyatli qo'shildi!")
            return redirect('admin_judges')
        
        judges = User.objects.filter(role='JUDGE').annotate(group_count=Count('assigned_groups')).order_by('username')
        return render(request, self.template_name, {'judges': judges, 'form': form})


class AdminJudgesDeleteView(AdminRequiredMixin, View):
    def post(self, request, pk):
        judge = get_object_or_404(User, pk=pk, role='JUDGE')
        username = judge.username
        judge.delete()
        messages.success(request, f"'{username}' hakami muvaffaqiyatli o'chirildi!")
        return redirect('admin_judges')


class AdminGroupsView(AdminRequiredMixin, View):
    template_name = 'admin_groups.html'

    def get(self, request):
        groups = Group.objects.annotate(
            evals_count=Count('evaluations')
        ).select_related('school_class').prefetch_related('members', 'judges').order_by('school_class__name', 'name')
        
        # Handle search & class filters
        query = request.GET.get('q', '').strip()
        class_filter = request.GET.get('class', '').strip()
        
        if query:
            groups = groups.filter(Q(name__icontains=query) | Q(project_name__icontains=query) | Q(members__name__icontains=query)).distinct()
        if class_filter:
            groups = groups.filter(school_class_id=class_filter)
            
        classes = SchoolClass.objects.all()
        form = GroupForm()
        return render(request, self.template_name, {
            'groups': groups,
            'classes': classes,
            'form': form,
            'selected_class': class_filter,
            'search_query': query
        })

    def post(self, request):
        form = GroupForm(request.POST)
        if form.is_valid():
            group = form.save()
            messages.success(request, f"'{group.name}' guruhi {group.members.count()} ta a'zosi bilan muvaffaqiyatli yaratildi!")
            return redirect('admin_groups')
        
        groups = Group.objects.annotate(evals_count=Count('evaluations')).select_related('school_class').order_by('school_class__name', 'name')
        classes = SchoolClass.objects.all()
        return render(request, self.template_name, {'groups': groups, 'classes': classes, 'form': form})


class AdminGroupEditView(AdminRequiredMixin, View):
    template_name = 'admin_groups.html'

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        groups = Group.objects.annotate(evals_count=Count('evaluations')).select_related('school_class').order_by('school_class__name', 'name')
        classes = SchoolClass.objects.all()
        form = GroupForm(instance=group)
        return render(request, self.template_name, {
            'groups': groups,
            'classes': classes,
            'form': form,
            'editing_group': group
        })

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        form = GroupForm(request.POST, instance=group)
        if form.is_valid():
            form.save()
            messages.success(request, f"'{group.name}' guruhi muvaffaqiyatli yangilandi!")
            return redirect('admin_groups')
        
        groups = Group.objects.annotate(evals_count=Count('evaluations')).select_related('school_class').order_by('school_class__name', 'name')
        classes = SchoolClass.objects.all()
        return render(request, self.template_name, {
            'groups': groups,
            'classes': classes,
            'form': form,
            'editing_group': group
        })


class AdminGroupDeleteView(AdminRequiredMixin, View):
    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        name = group.name
        group.delete()
        messages.success(request, f"'{name}' guruhi muvaffaqiyatli o'chirildi!")
        return redirect('admin_groups')


class AdminEvaluationsView(AdminRequiredMixin, ListView):
    model = Evaluation
    template_name = 'admin_evaluations.html'
    context_object_name = 'evaluations'
    paginate_by = 10

    def get_queryset(self):
        queryset = Evaluation.objects.select_related('group', 'judge', 'group__school_class').order_by('-created_at')
        q = self.request.GET.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(group__name__icontains=q) | 
                Q(group__project_name__icontains=q) | 
                Q(judge__username__icontains=q)
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['search_query'] = self.request.GET.get('q', '').strip()
        return context


class AdminRankingsView(AdminRequiredMixin, View):
    template_name = 'admin_rankings.html'

    def get(self, request):
        # Leaderboard ranking based on total_average_score
        groups = Group.objects.annotate(
            eval_count=Count('evaluations'),
            avg_fun=Coalesce(Avg('evaluations__score_functionality'), Value(0.0)),
            avg_arc=Coalesce(Avg('evaluations__score_architecture'), Value(0.0)),
            avg_per=Coalesce(Avg('evaluations__score_performance'), Value(0.0)),
            avg_sec=Coalesce(Avg('evaluations__score_security'), Value(0.0)),
            avg_ux=Coalesce(Avg('evaluations__score_ui_ux'), Value(0.0)),
            overall_avg=Coalesce(Avg(
                F('evaluations__score_functionality') +
                F('evaluations__score_architecture') +
                F('evaluations__score_performance') +
                F('evaluations__score_security') +
                F('evaluations__score_ui_ux')
            ) / 5.0, Value(0.0, output_field=FloatField()))
        ).select_related('school_class').prefetch_related('members').order_by('-overall_avg', '-eval_count')

        # Filter by class
        class_filter = request.GET.get('class', '').strip()
        if class_filter:
            groups = groups.filter(school_class_id=class_filter)

        classes = SchoolClass.objects.all()
        is_print = 'print' in request.GET

        if is_print:
            self.template_name = 'admin_rankings_print.html'

        return render(request, self.template_name, {
            'groups': groups,
            'classes': classes,
            'selected_class': class_filter,
            'is_print': is_print
        })


class AdminStatisticsView(AdminRequiredMixin, TemplateView):
    template_name = 'admin_statistics.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        evals = Evaluation.objects.all()
        
        # Categories average
        context['avg_fun'] = round(evals.aggregate(Avg('score_functionality'))['score_functionality__avg'] or 0, 2)
        context['avg_arc'] = round(evals.aggregate(Avg('score_architecture'))['score_architecture__avg'] or 0, 2)
        context['avg_per'] = round(evals.aggregate(Avg('score_performance'))['score_performance__avg'] or 0, 2)
        context['avg_sec'] = round(evals.aggregate(Avg('score_security'))['score_security__avg'] or 0, 2)
        context['avg_ux'] = round(evals.aggregate(Avg('score_ui_ux'))['score_ui_ux__avg'] or 0, 2)
        
        # Group scores for chart
        groups_data = Group.objects.annotate(
            overall_avg=Coalesce(Avg(
                F('evaluations__score_functionality') +
                F('evaluations__score_architecture') +
                F('evaluations__score_performance') +
                F('evaluations__score_security') +
                F('evaluations__score_ui_ux')
            ) / 5.0, Value(0.0, output_field=FloatField()))
        ).order_by('-overall_avg')[:10]
        
        context['chart_labels'] = [g.name for g in groups_data]
        context['chart_scores'] = [float(g.overall_avg) for g in groups_data]

        # Class performance
        class_perf = SchoolClass.objects.annotate(
            class_avg=Coalesce(Avg(
                F('groups__evaluations__score_functionality') +
                F('groups__evaluations__score_architecture') +
                F('groups__evaluations__score_performance') +
                F('groups__evaluations__score_security') +
                F('groups__evaluations__score_ui_ux')
            ) / 5.0, Value(0.0, output_field=FloatField()))
        ).order_by('-class_avg')
        
        context['class_labels'] = [c.name for c in class_perf]
        context['class_scores'] = [float(c.class_avg) for c in class_perf]

        return context


# ==========================================
# JUDGE PANEL & PAGES
# ==========================================

class JudgeDashboardView(JudgeRequiredMixin, TemplateView):
    template_name = 'judge_dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        judge = self.request.user
        
        # Get groups assigned to this judge
        assigned_groups = judge.assigned_groups.select_related('school_class').prefetch_related('members').order_by('school_class__name', 'name')
        
        # Annotate whether evaluated
        groups_list = []
        for group in assigned_groups:
            eval_instance = Evaluation.objects.filter(group=group, judge=judge).first()
            groups_list.append({
                'group': group,
                'evaluated': eval_instance is not None,
                'evaluation': eval_instance
            })
            
        context['assigned_groups'] = groups_list
        return context


class JudgeGroupDetailView(JudgeRequiredMixin, View):
    template_name = 'judge_group_detail.html'

    def get(self, request, pk):
        judge = request.user
        group = get_object_or_404(Group.objects.filter(judges=judge), pk=pk)
        eval_instance = Evaluation.objects.filter(group=group, judge=judge).first()
        other_evals = Evaluation.objects.filter(group=group).exclude(judge=judge).select_related('judge')
        
        return render(request, self.template_name, {
            'group': group,
            'evaluation': eval_instance,
            'other_evaluations': other_evals
        })


class JudgeEvaluateView(JudgeRequiredMixin, View):
    template_name = 'judge_evaluate.html'

    def get(self, request, pk):
        judge = request.user
        group = get_object_or_404(Group.objects.filter(judges=judge), pk=pk)
        
        # Check if evaluation already exists for editing
        eval_instance = Evaluation.objects.filter(group=group, judge=judge).first()
        form = EvaluationForm(instance=eval_instance)
        
        return render(request, self.template_name, {
            'group': group,
            'form': form,
            'editing': eval_instance is not None
        })

    def post(self, request, pk):
        judge = request.user
        group = get_object_or_404(Group.objects.filter(judges=judge), pk=pk)
        
        eval_instance = Evaluation.objects.filter(group=group, judge=judge).first()
        form = EvaluationForm(request.POST, instance=eval_instance)
        
        if form.is_valid():
            evaluation = form.save(commit=False)
            evaluation.judge = judge
            evaluation.group = group
            evaluation.save()
            
            if eval_instance:
                msg = f"'{group.project_name}' loyihasi uchun baholash muvaffaqiyatli yangilandi!"
            else:
                msg = f"'{group.project_name}' loyihasi uchun baholash muvaffaqiyatli yuborildi!"
            messages.success(request, msg)
            return redirect('judge_dashboard')
            
        return render(request, self.template_name, {
            'group': group,
            'form': form,
            'editing': eval_instance is not None
        })
