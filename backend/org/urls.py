from django.urls import path

from org import views

urlpatterns = [
    path("cities/", views.CityListView.as_view(), name="cities"),
    path("cities/clear/", views.CityClearView.as_view(), name="cities_clear"),
    path("cities/<int:pk>/", views.CityDetailView.as_view(), name="city_detail"),
    path("districts/", views.DistrictListView.as_view(), name="districts"),
    path("districts/<int:pk>/", views.DistrictDetailView.as_view(), name="district_detail"),
    path("branch-types/", views.BranchTypeListView.as_view(), name="branch_types"),
    path("branch-types/<int:pk>/", views.BranchTypeDetailView.as_view(), name="branch_type_detail"),
    path("brands/", views.BrandListView.as_view(), name="brands"),
    path("brands/<int:pk>/", views.BrandDetailView.as_view(), name="brand_detail"),
    path("branches/", views.BranchListView.as_view(), name="branches"),
    path("branches/<int:pk>/", views.BranchDetailView.as_view(), name="branch_detail"),
    path("users/", views.UserListView.as_view(), name="users"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="user_detail"),
    path("notification-preferences/", views.NotificationPreferenceView.as_view(), name="notification_preferences"),
    path("notifications/", views.AdminNotificationListView.as_view(), name="admin_notifications"),
    path("saved-views/", views.SavedViewListCreateView.as_view(), name="saved_views"),
    path("saved-views/<int:pk>/", views.SavedViewDetailView.as_view(), name="saved_view_detail"),
    path("activity-log/", views.ActivityLogListView.as_view(), name="activity_log_list"),
    path("activity-log/create/", views.ActivityLogCreateView.as_view(), name="activity_log_create"),
    path("role-permissions/<str:role>/", views.RolePermissionDetailView.as_view(), name="role_permission_detail"),
]

