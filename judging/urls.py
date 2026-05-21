from django.urls import path
from django.contrib.auth.views import LogoutView
from judging import views

urlpatterns = [
    # Auth & Redirections
    path('', views.DashboardRedirectView.as_view(), name='dashboard_redirect'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(next_page='login'), name='logout'),

    # Admin Panel
    path('admin-panel/', views.AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin-panel/classes/', views.AdminClassesView.as_view(), name='admin_classes'),
    path('admin-panel/classes/delete/<int:pk>/', views.AdminClassesDeleteView.as_view(), name='admin_classes_delete'),
    path('admin-panel/judges/', views.AdminJudgesView.as_view(), name='admin_judges'),
    path('admin-panel/judges/delete/<int:pk>/', views.AdminJudgesDeleteView.as_view(), name='admin_judges_delete'),
    path('admin-panel/groups/', views.AdminGroupsView.as_view(), name='admin_groups'),
    path('admin-panel/groups/edit/<int:pk>/', views.AdminGroupEditView.as_view(), name='admin_groups_edit'),
    path('admin-panel/groups/delete/<int:pk>/', views.AdminGroupDeleteView.as_view(), name='admin_groups_delete'),
    path('admin-panel/evaluations/', views.AdminEvaluationsView.as_view(), name='admin_evaluations'),
    path('admin-panel/rankings/', views.AdminRankingsView.as_view(), name='admin_rankings'),
    path('admin-panel/statistics/', views.AdminStatisticsView.as_view(), name='admin_statistics'),

    # Judge Panel
    path('judge/', views.JudgeDashboardView.as_view(), name='judge_dashboard'),
    path('judge/group/<int:pk>/', views.JudgeGroupDetailView.as_view(), name='judge_group_detail'),
    path('judge/group/<int:pk>/evaluate/', views.JudgeEvaluateView.as_view(), name='judge_evaluate'),
]
