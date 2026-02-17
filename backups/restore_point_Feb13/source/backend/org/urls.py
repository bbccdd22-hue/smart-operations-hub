from django.urls import path

from org import views

urlpatterns = [
    path("cities/", views.CityListView.as_view(), name="cities"),
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
]

